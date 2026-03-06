import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user's experiments
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const experiments = await prisma.experiment.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(experiments);
  } catch (error) {
    next(error);
  }
});

// Create experiment
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      formula: z.string().min(1),
      description: z.string().optional(),
      results: z.any().optional(),
    });

    const { name, formula, description, results } = schema.parse(req.body);

    const experiment = await prisma.experiment.create({
      data: {
        userId: req.user!.id,
        name,
        formula,
        description,
        results: results || {},
      },
    });

    res.status(201).json(experiment);
  } catch (error) {
    next(error);
  }
});

// Get single experiment
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const experiment = await prisma.experiment.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json(experiment);
  } catch (error) {
    next(error);
  }
});

// Update experiment
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(1).optional(),
      formula: z.string().min(1).optional(),
      description: z.string().optional(),
      results: z.any().optional(),
    });

    const updates = schema.parse(req.body);

    const experiment = await prisma.experiment.update({
      where: {
        id,
        userId: req.user!.id,
      },
      data: updates,
    });

    res.json(experiment);
  } catch (error) {
    next(error);
  }
});

// Delete experiment
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.experiment.delete({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    res.json({ message: 'Experiment deleted' });
  } catch (error) {
    next(error);
  }
});

export { router as experimentRouter };
