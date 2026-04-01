import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { audit } from '../middleware/auditLogger';
import { prisma } from '../config/database';
import { generateApiKey, hashApiKey, maskSensitiveData } from '../utils/encryption';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  allowedIps: z.array(z.string().ip()).optional(),
  rateLimit: z.number().min(100).max(100000).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  allowedIps: z.array(z.string().ip()).optional(),

});

// List API keys
router.get('/', authenticate, async (req, res) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: req.organization!.id,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        permissions: true,
        allowedIps: true,
        rateLimit: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        
        createdAt: true,
        createdBy: true,
      },
    });
    
    res.json(apiKeys);
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Create API key
router.post(
  '/',
  authenticate,
  requireRole('ADMIN' as UserRole),
  audit.apiKeyCreated(),
  async (req, res) => {
    try {
      const data = createApiKeySchema.parse(req.body);
      
      // Check API key limit
      const org = await prisma.organization.findUnique({
        where: { id: req.organization!.id },
        include: {
          _count: { select: { apiKeys: { where: { revokedAt: null } } } },
        },
      });
      
      // Default limits by plan
      const planLimits: Record<string, number> = {
        FREE: 1,
        STARTER: 5,
        PROFESSIONAL: 20,
        ENTERPRISE: 100,
      };
      
      const maxKeys = planLimits[org!.plan] || 1;
      if (org!._count.apiKeys >= maxKeys) {
        return res.status(400).json({
          error: 'API key limit reached',
          message: `Your ${org!.plan} plan allows up to ${maxKeys} API keys`,
        });
      }
      
      // Generate API key
      const { key, prefix } = generateApiKey();
      const keyHash = hashApiKey(key);
      
      // Calculate expiration
      let expiresAt: Date | undefined;
      if (data.expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
      }
      
      // Create API key record
      const apiKey = await prisma.apiKey.create({
        data: {
          name: data.name,
          description: data.description,
          keyHash,
          keyPrefix: prefix,
          permissions: data.permissions || ['stocks:read', 'watchlist:read'],
          allowedIps: data.allowedIps || [],
          rateLimit: data.rateLimit || 1000,
          expiresAt,
          organizationId: req.organization!.id,
          createdBy: req.user!.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
          keyPrefix: true,
          permissions: true,
          allowedIps: true,
          rateLimit: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      
      // Return the full key (only time it's visible)
      res.status(201).json({
        ...apiKey,
        key, // IMPORTANT: This is the only time the full key is returned
        warning: 'This is the only time the API key will be shown. Store it securely.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Create API key error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

// Get API key details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        permissions: true,
        allowedIps: true,
        rateLimit: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        
        revokedAt: true,
        revokedReason: true,
        createdAt: true,
        createdBy: true,
      },
    });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json(apiKey);
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

// Update API key
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN' as UserRole),
  async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateApiKeySchema.parse(req.body);
      
      const apiKey = await prisma.apiKey.updateMany({
        where: {
          id,
          organizationId: req.organization!.id,
          revokedAt: null,
        },
        data,
      });
      
      if (apiKey.count === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Update API key error:', error);
      res.status(500).json({ error: 'Failed to update API key' });
    }
  }
);

// Revoke API key
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN' as UserRole),
  audit.apiKeyRevoked(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
      
      const apiKey = await prisma.apiKey.updateMany({
        where: {
          id,
          organizationId: req.organization!.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedBy: req.user!.id,
          revokedReason: reason,

        },
      });
      
      if (apiKey.count === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Revoke API key error:', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  }
);

// Get API key usage logs
router.get('/:id/logs', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '50' } = req.query;
    
    // Verify API key belongs to organization
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
      },
    });
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const [logs, total] = await Promise.all([
      prisma.apiKeyLog.findMany({
        where: { apiKeyId: id },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          endpoint: true,
          method: true,
          statusCode: true,
          responseTime: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      prisma.apiKeyLog.count({ where: { apiKeyId: id } }),
    ]);
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Get API key logs error:', error);
    res.status(500).json({ error: 'Failed to get API key logs' });
  }
});

// Roll API key (revoke old and create new)
router.post(
  '/:id/roll',
  authenticate,
  requireRole('ADMIN' as UserRole),
  audit.apiKeyRevoked(),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing key
      const existingKey = await prisma.apiKey.findFirst({
        where: {
          id,
          organizationId: req.organization!.id,
          revokedAt: null,
        },
      });
      
      if (!existingKey) {
        return res.status(404).json({ error: 'API key not found' });
      }
      
      // Revoke old key
      await prisma.apiKey.update({
        where: { id },
        data: {
          revokedAt: new Date(),
          revokedBy: req.user!.id,
          revokedReason: 'Rolled to new key',

        },
      });
      
      // Generate new key
      const { key, prefix } = generateApiKey();
      const keyHash = hashApiKey(key);
      
      // Create new key with same settings
      const newKey = await prisma.apiKey.create({
        data: {
          name: `${existingKey.name} (Rolled)`,
          description: existingKey.description,
          keyHash,
          keyPrefix: prefix,
          permissions: existingKey.permissions,
          allowedIps: existingKey.allowedIps,
          rateLimit: existingKey.rateLimit,
          expiresAt: existingKey.expiresAt,
          organizationId: req.organization!.id,
          createdBy: req.user!.id,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          permissions: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      
      res.status(201).json({
        ...newKey,
        key,
        warning: 'This is the only time the API key will be shown. Store it securely.',
        previousKeyId: id,
      });
    } catch (error) {
      console.error('Roll API key error:', error);
      res.status(500).json({ error: 'Failed to roll API key' });
    }
  }
);

export default router;
