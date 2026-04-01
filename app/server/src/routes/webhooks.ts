import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { audit } from '../middleware/auditLogger';
import { prisma } from '../config/database';
import { generateSecret, generateWebhookSignature } from '../utils/encryption';
import { z } from 'zod';

const router = Router();

// Available webhook events
export const WEBHOOK_EVENTS = [
  // Stock events
  'stock.price.changed',
  'stock.volume.spike',
  
  // Alert events
  'alert.triggered',
  'alert.created',
  'alert.updated',
  'alert.deleted',
  
  // Portfolio events
  'portfolio.updated',
  'portfolio.holding.added',
  'portfolio.holding.removed',
  'portfolio.transaction.created',
  
  // Watchlist events
  'watchlist.updated',
  'watchlist.item.added',
  'watchlist.item.removed',
  
  // User events
  'user.invited',
  'user.joined',
  'user.role.changed',
  
  // Organization events
  'organization.settings.changed',
  'subscription.changed',
  
  // API events
  'api.rate_limit.approaching',
  'api.rate_limit.exceeded',
] as const;

// Validation schemas
const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  description: z.string().max(500).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(1).max(3600).default(60), // seconds
    exponentialBackoff: z.boolean().default(true),
  }).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  description: z.string().max(500).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
  isActive: z.boolean().optional(),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10).optional(),
    retryDelay: z.number().min(1).max(3600).optional(),
    exponentialBackoff: z.boolean().optional(),
  }).optional(),
});

const testWebhookSchema = z.object({
  event: z.enum(WEBHOOK_EVENTS),
  payload: z.record(z.any()).optional(),
});

// List webhooks
router.get('/', authenticate, async (req, res) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        failureCount: true,
        createdAt: true,
        createdBy: true,
      },
    });
    
    res.json(webhooks);
  } catch (error) {
    console.error('List webhooks error:', error);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// Create webhook
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.webhookCreated(),
  async (req, res) => {
    try {
      const data = createWebhookSchema.parse(req.body);
      
      // Check webhook limit
      const org = await prisma.organization.findUnique({
        where: { id: req.organization!.id },
        include: {
          _count: { select: { webhooks: { where: { deletedAt: null } } } },
        },
      });
      
      if (org!._count.webhooks >= org!.maxWebhooks) {
        return res.status(400).json({
          error: 'Webhook limit reached',
          message: `Your plan allows up to ${org!.maxWebhooks} webhooks`,
        });
      }
      
      // Generate webhook secret
      const secret = generateSecret();
      
      const webhook = await prisma.webhook.create({
        data: {
          name: data.name,
          url: data.url,
          description: data.description,
          events: data.events,
          secret,
          retryPolicy: data.retryPolicy || {
            maxRetries: 3,
            retryDelay: 60,
            exponentialBackoff: true,
          },
          organizationId: req.organization!.id,
          createdBy: req.user!.id,
        },
        select: {
          id: true,
          name: true,
          url: true,
          description: true,
          events: true,
          isActive: true,
          retryPolicy: true,
          createdAt: true,
        },
      });
      
      res.status(201).json({
        ...webhook,
        secret, // Only shown once
        warning: 'This is the only time the webhook secret will be shown. Store it securely to verify webhook signatures.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Create webhook error:', error);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  }
);

// Get webhook details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
      },
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        retryPolicy: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        failureCount: true,
        createdAt: true,
        createdBy: true,
      },
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    res.json(webhook);
  } catch (error) {
    console.error('Get webhook error:', error);
    res.status(500).json({ error: 'Failed to get webhook' });
  }
});

// Update webhook
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.webhookUpdated(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateWebhookSchema.parse(req.body);
      
      const webhook = await prisma.webhook.updateMany({
        where: {
          id,
          organizationId: req.organization!.id,
          deletedAt: null,
        },
        data,
      });
      
      if (webhook.count === 0) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Update webhook error:', error);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  }
);

// Delete webhook
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.webhookDeleted(),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.webhook.updateMany({
        where: {
          id,
          organizationId: req.organization!.id,
        },
        data: { deletedAt: new Date() },
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete webhook error:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  }
);

// Regenerate webhook secret
router.post(
  '/:id/regenerate-secret',
  authenticate,
  requireRole(UserRole.ADMIN),
  audit.webhookUpdated(),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const secret = generateSecret();
      
      const webhook = await prisma.webhook.updateMany({
        where: {
          id,
          organizationId: req.organization!.id,
          deletedAt: null,
        },
        data: { secret },
      });
      
      if (webhook.count === 0) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      
      res.json({
        secret,
        warning: 'This is the only time the webhook secret will be shown. Store it securely.',
      });
    } catch (error) {
      console.error('Regenerate webhook secret error:', error);
      res.status(500).json({ error: 'Failed to regenerate secret' });
    }
  }
);

// Test webhook
router.post(
  '/:id/test',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const data = testWebhookSchema.parse(req.body);
      
      const webhook = await prisma.webhook.findFirst({
        where: {
          id,
          organizationId: req.organization!.id,
          deletedAt: null,
        },
      });
      
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      
      // Build test payload
      const payload = {
        event: data.event,
        timestamp: new Date().toISOString(),
        data: data.payload || { message: 'This is a test event' },
      };
      
      const body = JSON.stringify(payload);
      const signature = generateWebhookSignature(body, webhook.secret);
      
      // Send test request
      const startTime = Date.now();
      let response;
      let error;
      
      try {
        const fetch = (await import('node-fetch')).default;
        response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': data.event,
            'X-Webhook-ID': webhook.id,
            'X-Webhook-Timestamp': Date.now().toString(),
            'User-Agent': 'AlphaSpectrum-Webhook/1.0',
          },
          body,
          timeout: 30000,
        });
      } catch (e: any) {
        error = e.message;
      }
      
      const responseTime = Date.now() - startTime;
      
      // Create delivery record
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType: data.event,
          payload,
          requestHeaders: {
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': data.event,
          },
          requestBody: body,
          responseStatus: response?.status,
          responseHeaders: response ? Object.fromEntries(response.headers.entries()) : undefined,
          responseBody: response ? await response.text() : undefined,
          responseTime,
          status: response?.ok ? 'DELIVERED' : 'FAILED',
          errorMessage: error,
        },
      });
      
      res.json({
        success: !error && response?.ok,
        responseStatus: response?.status,
        responseTime,
        error,
        payload,
        signature,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Test webhook error:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  }
);

// Get webhook delivery history
router.get('/:id/deliveries', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '50', status } = req.query;
    
    // Verify webhook belongs to organization
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
      },
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const where: any = { webhookId: id };
    if (status) where.status = status;
    
    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          status: true,
          responseStatus: true,
          responseTime: true,
          attemptCount: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.webhookDelivery.count({ where }),
    ]);
    
    res.json({
      deliveries,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Get webhook deliveries error:', error);
    res.status(500).json({ error: 'Failed to get delivery history' });
  }
});

// Get delivery details
router.get('/:id/deliveries/:deliveryId', authenticate, async (req, res) => {
  try {
    const { id, deliveryId } = req.params;
    
    // Verify webhook belongs to organization
    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
      },
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        webhookId: id,
      },
    });
    
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    res.json(delivery);
  } catch (error) {
    console.error('Get delivery details error:', error);
    res.status(500).json({ error: 'Failed to get delivery details' });
  }
});

export default router;
