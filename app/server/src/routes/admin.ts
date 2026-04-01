import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { z } from 'zod';

const router = Router();

// Super admin middleware
const requireSuperAdmin = requireRole('OWNER'); // Or create a SUPER_ADMIN role

// Get all organizations (super admin only)
router.get('/organizations', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '50', status, plan, search } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const where: any = {};
    
    if (status) where.subscriptionStatus = status;
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { slug: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              apiKeys: { where: { revokedAt: null } },
              webhooks: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);
    
    res.json({
      organizations,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Failed to get organizations' });
  }
});

// Get organization details
router.get('/organizations/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            teams: true,
            apiKeys: true,
            webhooks: true,
            watchlists: true,
            portfolios: true,
            alerts: true,
            experiments: true,
            auditLogs: true,
          },
        },
      },
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// Update organization (super admin)
router.patch('/organizations/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
      subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED']).optional(),
      subscriptionExpiresAt: z.string().datetime().optional(),
      maxUsers: z.number().optional(),
      maxApiCalls: z.number().optional(),
      maxWebhooks: z.number().optional(),
      features: z.record(z.any()).optional(),
    });
    
    const data = schema.parse(req.body);
    
    const updateData: any = { ...data };
    if (data.subscriptionExpiresAt) {
      updateData.subscriptionExpiresAt = new Date(data.subscriptionExpiresAt);
    }
    
    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });
    
    res.json(organization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get system stats
router.get('/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [
      totalOrganizations,
      totalUsers,
      activeUsers,
      totalApiKeys,
      totalWebhooks,
      organizationsByPlan,
      recentSignups,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.apiKey.count({ where: { revokedAt: null } }),
      prisma.webhook.count({ where: { deletedAt: null } }),
      prisma.organization.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
      prisma.organization.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          plan: true,
          createdAt: true,
        },
      }),
    ]);
    
    res.json({
      totals: {
        organizations: totalOrganizations,
        users: totalUsers,
        activeUsers,
        apiKeys: totalApiKeys,
        webhooks: totalWebhooks,
      },
      organizationsByPlan,
      recentSignups,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get system health
router.get('/health', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    
    // Get recent errors from audit logs
    const recentErrors = await prisma.auditLog.findMany({
      where: {
        action: { in: ['LOGIN_FAILED', 'PERMISSION_DENIED', 'RATE_LIMITED'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    res.json({
      database: dbHealthy ? 'healthy' : 'unhealthy',
      recentErrors: {
        count: recentErrors.length,
        items: recentErrors,
      },
    });
  } catch (error) {
    console.error('Get health error:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

// Impersonate user
router.post('/impersonate/:userId', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate impersonation token
    const jwt = await import('jsonwebtoken');
    const { config } = await import('../config');
    
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        permissions: [...user.permissions, 'impersonated'],
        impersonatedBy: req.user!.id,
        type: 'access',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        organization: user.organization.name,
      },
    });
  } catch (error) {
    console.error('Impersonate error:', error);
    res.status(500).json({ error: 'Failed to impersonate user' });
  }
});

export default router;
