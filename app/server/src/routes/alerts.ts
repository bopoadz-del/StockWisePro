import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';
import { AlertType, AlertCondition } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Get all alerts
router.get('/', authenticate, async (req, res) => {
  try {
    const { ticker, isActive } = req.query;
    
    const where: any = {
      organizationId: req.organization!.id,
      deletedAt: null,
    };
    
    if (ticker) where.ticker = ticker.toString().toUpperCase();
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Create alert
router.post('/', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().max(100).optional(),
      ticker: z.string().min(1).max(10),
      type: z.nativeEnum(AlertType),
      condition: z.nativeEnum(AlertCondition),
      value: z.number(),
      notifyEmail: z.boolean().default(true),
      notifyWebhook: z.boolean().default(false),
      notifyInApp: z.boolean().default(true),
    });
    
    const data = schema.parse(req.body);
    
    const alert = await prisma.alert.create({
      data: {
        name: data.name || `${data.ticker} ${data.condition} ${data.value}`,
        ticker: data.ticker.toUpperCase(),
        type: data.type,
        condition: data.condition,
        value: data.value,
        notifyEmail: data.notifyEmail,
        notifyWebhook: data.notifyWebhook,
        notifyInApp: data.notifyInApp,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
      },
    });
    
    res.status(201).json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Get single alert
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.alert.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to get alert' });
  }
});

// Update alert
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().max(100).optional(),
      condition: z.nativeEnum(AlertCondition).optional(),
      value: z.number().optional(),
      isActive: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      notifyWebhook: z.boolean().optional(),
      notifyInApp: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const alert = await prisma.alert.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      data,
    });
    
    if (alert.count === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update alert error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete alert
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.alert.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
      },
      data: { deletedAt: new Date() },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Toggle alert status
router.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.alert.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
    });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    const updated = await prisma.alert.update({
      where: { id },
      data: { isActive: !alert.isActive },
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Toggle alert error:', error);
    res.status(500).json({ error: 'Failed to toggle alert' });
  }
});

export default router;
