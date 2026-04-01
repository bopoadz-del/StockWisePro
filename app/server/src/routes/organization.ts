import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { audit } from '../middleware/auditLogger';
import { createRateLimiter } from '../middleware/rateLimiter';
import { prisma } from '../config/database';
import { UserRole, PlanType } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  settings: z.record(z.any()).optional(),
});

const updateSecuritySchema = z.object({
  requireMfa: z.boolean().optional(),
  allowedEmailDomains: z.array(z.string()).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  sessionTimeout: z.number().min(15).max(1440).optional(),
  passwordPolicy: z.object({
    minLength: z.number().optional(),
    requireUppercase: z.boolean().optional(),
    requireLowercase: z.boolean().optional(),
    requireNumbers: z.boolean().optional(),
    requireSymbols: z.boolean().optional(),
  }).optional(),
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.MEMBER),
  teamIds: z.array(z.string()).optional(),
});

// Get current organization
router.get('/me', authenticate, async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.organization!.id },
      include: {
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            teams: { where: { deletedAt: null } },
            apiKeys: { where: { revokedAt: null } },
            webhooks: { where: { deletedAt: null } },
          },
        },
      },
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      website: organization.website,
      logoUrl: organization.logoUrl,
      plan: organization.plan,
      subscriptionStatus: organization.subscriptionStatus,
      subscriptionExpiresAt: organization.subscriptionExpiresAt,
      settings: organization.settings,
      features: organization.features,
      quotas: {
        maxUsers: organization.maxUsers,
        maxApiCalls: organization.maxApiCalls,
        maxWebhooks: organization.maxWebhooks,
        maxTeams: organization.maxTeams,
        storageQuota: organization.storageQuota,
      },
      usage: {
        users: organization._count.users,
        teams: organization._count.teams,
        apiKeys: organization._count.apiKeys,
        webhooks: organization._count.webhooks,
      },
      security: {
        requireMfa: organization.requireMfa,
        allowedEmailDomains: organization.allowedEmailDomains,
        sessionTimeout: organization.sessionTimeout,
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// Update organization
router.patch(
  '/me',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.orgUpdated(),
  async (req, res) => {
    try {
      const data = updateOrganizationSchema.parse(req.body);
      
      const organization = await prisma.organization.update({
        where: { id: req.organization!.id },
        data,
      });
      
      res.json(organization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Update organization error:', error);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  }
);

// Update security settings
router.patch(
  '/me/security',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.orgSettingsChanged(),
  async (req, res) => {
    try {
      const data = updateSecuritySchema.parse(req.body);
      
      const organization = await prisma.organization.update({
        where: { id: req.organization!.id },
        data,
      });
      
      res.json({
        requireMfa: organization.requireMfa,
        allowedEmailDomains: organization.allowedEmailDomains,
        ipWhitelist: organization.ipWhitelist,
        sessionTimeout: organization.sessionTimeout,
        passwordPolicy: organization.passwordPolicy,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Update security settings error:', error);
      res.status(500).json({ error: 'Failed to update security settings' });
    }
  }
);

// Get organization users
router.get('/me/users', authenticate, async (req, res) => {
  try {
    const { page = '1', limit = '20', status, role, search } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const where: any = {
      organizationId: req.organization!.id,
      deletedAt: null,
    };
    
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          status: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    
    res.json({
      users,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Invite user
router.post(
  '/me/users',
  authenticate,
  requireRole(UserRole.ADMIN),
  createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10 }),
  audit.userInvited(),
  async (req, res) => {
    try {
      const data = inviteUserSchema.parse(req.body);
      
      // Check user limit
      const org = await prisma.organization.findUnique({
        where: { id: req.organization!.id },
        include: {
          _count: { select: { users: { where: { deletedAt: null } } } },
        },
      });
      
      if (org!._count.users >= org!.maxUsers) {
        return res.status(400).json({ 
          error: 'User limit reached',
          message: `Your plan allows up to ${org!.maxUsers} users`,
        });
      }
      
      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          organizationId: req.organization!.id,
          deletedAt: null,
        },
      });
      
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists in this organization' });
      }
      
      // Create user with pending status
      const user = await prisma.user.create({
        data: {
          email: data.email,
          organizationId: req.organization!.id,
          role: data.role,
          status: 'PENDING',
          invitedBy: req.user!.id,
          invitedAt: new Date(),
        },
      });
      
      // TODO: Send invitation email
      
      res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        invitedAt: user.invitedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Invite user error:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }
);

// Update user role
router.patch(
  '/me/users/:id/role',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.userUpdated(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = z.object({ role: z.nativeEnum(UserRole) }).parse(req.body);
      
      // Prevent changing own role
      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      
      // Get target user
      const targetUser = await prisma.user.findFirst({
        where: { id, organizationId: req.organization!.id },
      });
      
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Only owners can assign owner role
      if (role === UserRole.OWNER && req.user!.role !== UserRole.OWNER) {
        return res.status(403).json({ error: 'Only owners can assign owner role' });
      }
      
      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          role: true,
          updatedAt: true,
        },
      });
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Update user role error:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// Suspend/activate user
router.patch(
  '/me/users/:id/status',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.userUpdated(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }).parse(req.body);
      
      // Prevent suspending self
      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot change your own status' });
      }
      
      const user = await prisma.user.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          email: true,
          status: true,
          updatedAt: true,
        },
      });
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Update user status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

// Delete user
router.delete(
  '/me/users/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.userDeleted(),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting self
      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }
      
      // Soft delete
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// Get usage metrics
router.get('/me/usage', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {
      organizationId: req.organization!.id,
    };
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    
    const metrics = await prisma.usageMetrics.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    
    // Aggregate totals
    const totals = metrics.reduce(
      (acc, m) => ({
        apiCalls: acc.apiCalls + m.apiCalls,
        webhookCalls: acc.webhookCalls + m.webhookCalls,
        emailNotifications: acc.emailNotifications + m.emailNotifications,
        storageUsed: Math.max(acc.storageUsed, Number(m.storageUsed)),
      }),
      { apiCalls: 0, webhookCalls: 0, emailNotifications: 0, storageUsed: 0 }
    );
    
    res.json({
      metrics,
      totals,
      planLimits: {
        apiCalls: req.organization!.settings?.maxApiCalls || 1000,
      },
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage metrics' });
  }
});

export default router;
