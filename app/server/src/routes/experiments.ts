import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';
import { z } from 'zod';

const router = Router();

// Get all experiments
router.get('/', authenticate, async (req, res) => {
  try {
    const { isPublic } = req.query;
    
    const where: any = {
      organizationId: req.organization!.id,
      deletedAt: null,
    };
    
    if (isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }
    
    const experiments = await prisma.experiment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(experiments);
  } catch (error) {
    console.error('Get experiments error:', error);
    res.status(500).json({ error: 'Failed to get experiments' });
  }
});

// Create experiment
router.post('/', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      formula: z.record(z.any()),
      backtestConfig: z.record(z.any()).optional(),
      isPublic: z.boolean().default(false),
    });
    
    const data = schema.parse(req.body);
    
    const experiment = await prisma.experiment.create({
      data: {
        name: data.name,
        description: data.description,
        formula: data.formula,
        backtestConfig: data.backtestConfig,
        isPublic: data.isPublic,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
      },
    });
    
    res.status(201).json(experiment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create experiment error:', error);
    res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// Get single experiment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const experiment = await prisma.experiment.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
    });
    
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }
    
    res.json(experiment);
  } catch (error) {
    console.error('Get experiment error:', error);
    res.status(500).json({ error: 'Failed to get experiment' });
  }
});

// Update experiment
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      formula: z.record(z.any()).optional(),
      backtestConfig: z.record(z.any()).optional(),
      isPublic: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const experiment = await prisma.experiment.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      data,
    });
    
    if (experiment.count === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update experiment error:', error);
    res.status(500).json({ error: 'Failed to update experiment' });
  }
});

// Delete experiment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.experiment.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
      },
      data: { deletedAt: new Date() },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete experiment error:', error);
    res.status(500).json({ error: 'Failed to delete experiment' });
  }
});

// Run experiment backtest
router.post('/:id/run', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, initialCapital } = req.body;
    
    const experiment = await prisma.experiment.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
    });
    
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }
    
    // Simulate backtest results
    const results = {
      startDate,
      endDate,
      initialCapital,
      finalCapital: initialCapital * (1 + (Math.random() * 0.5 - 0.1)),
      totalReturn: (Math.random() * 50 - 10).toFixed(2) + '%',
      maxDrawdown: (Math.random() * 20).toFixed(2) + '%',
      sharpeRatio: (Math.random() * 2).toFixed(2),
      trades: Math.floor(Math.random() * 100),
      winRate: (Math.random() * 40 + 30).toFixed(2) + '%',
    };
    
    // Save results
    await prisma.experiment.update({
      where: { id },
      data: { backtestResults: results },
    });
    
    res.json(results);
  } catch (error) {
    console.error('Run experiment error:', error);
    res.status(500).json({ error: 'Failed to run experiment' });
  }
});

export default router;
