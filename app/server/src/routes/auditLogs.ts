import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { AuditAction } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const querySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('50'),
  action: z.nativeEnum(AuditAction).optional(),
  userId: z.string().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// List audit logs
router.get(
  '/',
  authenticate,
  requireRole(UserRole.MANAGER),
  async (req, res) => {
    try {
      const query = querySchema.parse(req.query);
      
      const skip = (parseInt(query.page) - 1) * parseInt(query.limit);
      const take = parseInt(query.limit);
      
      const where: any = {
        organizationId: req.organization!.id,
      };
      
      if (query.action) where.action = query.action;
      if (query.userId) where.userId = query.userId;
      if (query.resourceType) where.resourceType = query.resourceType;
      
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) where.createdAt.gte = new Date(query.startDate);
        if (query.endDate) where.createdAt.lte = new Date(query.endDate);
      }
      
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);
      
      res.json({
        logs,
        pagination: {
          page: parseInt(query.page),
          limit: take,
          total,
          pages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
      }
      console.error('List audit logs error:', error);
      res.status(500).json({ error: 'Failed to list audit logs' });
    }
  }
);

// Get audit log statistics
router.get(
  '/stats',
  authenticate,
  requireRole(UserRole.MANAGER),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const where: any = {
        organizationId: req.organization!.id,
      };
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }
      
      // Get action breakdown
      const actionStats = await prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      });
      
      // Get daily counts
      const dailyStats = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', "createdAt") as date,
          COUNT(*) as count
        FROM "audit_logs"
        WHERE "organizationId" = ${req.organization!.id}
        ${startDate ? prisma.$queryRaw`AND "createdAt" >= ${new Date(startDate as string)}` : prisma.$queryRaw``}
        ${endDate ? prisma.$queryRaw`AND "createdAt" <= ${new Date(endDate as string)}` : prisma.$queryRaw``}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date DESC
        LIMIT 30
      `;
      
      // Get most active users
      const userStats = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          ...where,
          userId: { not: null },
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      });
      
      // Get user details for stats
      const userIds = userStats.map(s => s.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      
      const userStatsWithDetails = userStats.map(stat => ({
        ...stat,
        user: users.find(u => u.id === stat.userId),
      }));
      
      res.json({
        total: await prisma.auditLog.count({ where }),
        actionBreakdown: actionStats,
        dailyStats,
        topUsers: userStatsWithDetails,
      });
    } catch (error) {
      console.error('Get audit stats error:', error);
      res.status(500).json({ error: 'Failed to get audit statistics' });
    }
  }
);

// Get single audit log details
router.get('/:id', authenticate, requireRole(UserRole.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    
    const log = await prisma.auditLog.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
    
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// Export audit logs (CSV)
router.post(
  '/export',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { startDate, endDate, action, format = 'csv' } = req.body;
      
      const where: any = {
        organizationId: req.organization!.id,
      };
      
      if (action) where.action = action;
      if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
      if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
      
      // Limit export to 10,000 records
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
        include: {
          user: {
            select: { email: true },
          },
        },
      });
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
        return res.json(logs);
      }
      
      // CSV format
      const headers = ['ID', 'Timestamp', 'Action', 'User', 'Resource Type', 'Resource ID', 'Description', 'IP Address'];
      const rows = logs.map(log => [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.user?.email || 'System',
        log.resourceType,
        log.resourceId || '',
        `"${log.description.replace(/"/g, '""')}"`, // Escape quotes
        log.ipAddress || '',
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Export audit logs error:', error);
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }
);

// Get audit log actions (for filtering)
router.get('/actions/list', authenticate, async (req, res) => {
  try {
    const actions = Object.values(AuditAction).sort();
    
    // Group by category
    const grouped = actions.reduce((acc, action) => {
      const category = action.split('_')[0];
      if (!acc[category]) acc[category] = [];
      acc[category].push(action);
      return acc;
    }, {} as Record<string, string[]>);
    
    res.json({
      all: actions,
      grouped,
    });
  } catch (error) {
    console.error('Get audit actions error:', error);
    res.status(500).json({ error: 'Failed to get audit actions' });
  }
});

export default router;
