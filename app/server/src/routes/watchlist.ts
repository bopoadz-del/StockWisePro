import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { audit } from '../middleware/auditLogger';
import { prisma } from '../config/database';
import { z } from 'zod';

const router = Router();

// Get all watchlists for organization
router.get('/', authenticate, async (req, res) => {
  try {
    const watchlists = await prisma.watchlist.findMany({
      where: {
        organizationId: req.organization!.id,
        deletedAt: null,
        OR: [
          { isPublic: true },
          { createdBy: req.user!.id },
          { teamId: null },
        ],
      },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(watchlists);
  } catch (error) {
    console.error('Get watchlists error:', error);
    res.status(500).json({ error: 'Failed to get watchlists' });
  }
});

// Create watchlist
router.post('/', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      teamId: z.string().optional(),
      isPublic: z.boolean().default(false),
    });
    
    const data = schema.parse(req.body);
    
    const watchlist = await prisma.watchlist.create({
      data: {
        name: data.name,
        description: data.description,
        teamId: data.teamId,
        isPublic: data.isPublic,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
      },
    });
    
    res.status(201).json(watchlist);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create watchlist error:', error);
    res.status(500).json({ error: 'Failed to create watchlist' });
  }
});

// Get single watchlist
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const watchlist = await prisma.watchlist.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
        },
      },
    });
    
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }
    
    res.json(watchlist);
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ error: 'Failed to get watchlist' });
  }
});

// Update watchlist
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      isPublic: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const watchlist = await prisma.watchlist.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
        deletedAt: null,
      },
      data,
    });
    
    if (watchlist.count === 0) {
      return res.status(404).json({ error: 'Watchlist not found or not owned by you' });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update watchlist error:', error);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// Delete watchlist
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const watchlist = await prisma.watchlist.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
      },
      data: { deletedAt: new Date() },
    });
    
    if (watchlist.count === 0) {
      return res.status(404).json({ error: 'Watchlist not found or not owned by you' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete watchlist error:', error);
    res.status(500).json({ error: 'Failed to delete watchlist' });
  }
});

// Add item to watchlist
router.post('/:id/items', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      ticker: z.string().min(1).max(10),
      notes: z.string().max(500).optional(),
    });
    
    const data = schema.parse(req.body);
    
    // Verify watchlist belongs to user/org
    const watchlist = await prisma.watchlist.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
    });
    
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }
    
    // Create stock if doesn't exist
    await prisma.stock.upsert({
      where: { ticker: data.ticker.toUpperCase() },
      create: {
        ticker: data.ticker.toUpperCase(),
        name: data.ticker.toUpperCase(),
      },
      update: {},
    });
    
    const item = await prisma.watchlistItem.create({
      data: {
        watchlistId: id,
        ticker: data.ticker.toUpperCase(),
        notes: data.notes,
        addedBy: req.user!.id,
      },
    });
    
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Add watchlist item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Remove item from watchlist
router.delete('/:id/items/:ticker', authenticate, async (req, res) => {
  try {
    const { id, ticker } = req.params;
    
    // Verify watchlist belongs to user/org
    const watchlist = await prisma.watchlist.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
    });
    
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }
    
    await prisma.watchlistItem.deleteMany({
      where: {
        watchlistId: id,
        ticker: ticker.toUpperCase(),
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove watchlist item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

export default router;
