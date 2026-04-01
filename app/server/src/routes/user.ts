import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

// Get user sessions
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user!.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceType: true,
        deviceName: true,
        browser: true,
        os: true,
        ipAddress: true,
        country: true,
        city: true,
        lastActivityAt: true,
        createdAt: true,
      },
    });
    
    // Mark current session
    const currentSessionId = req.headers['x-session-id'];
    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
    
    res.json(sessionsWithCurrent);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Revoke session
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.session.deleteMany({
      where: {
        id,
        userId: req.user!.id,
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// Revoke all other sessions
router.post('/sessions/revoke-all', authenticate, async (req, res) => {
  try {
    const currentSessionId = req.headers['x-session-id'] as string;
    
    await prisma.session.deleteMany({
      where: {
        userId: req.user!.id,
        id: { not: currentSessionId },
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// Get notification preferences
router.get('/notifications', authenticate, async (req, res) => {
  try {
    // Return default preferences (can be stored in user.settings)
    res.json({
      email: {
        priceAlerts: true,
        portfolioUpdates: true,
        newsDigest: false,
        marketing: false,
      },
      push: {
        priceAlerts: true,
        portfolioUpdates: true,
        marketOpen: false,
      },
      webhooks: {
        priceAlerts: false,
        portfolioUpdates: false,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update notification preferences
router.patch('/notifications', authenticate, async (req, res) => {
  try {
    // Store in user settings
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        // settings: { notificationPreferences: req.body }
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Get user activity
router.get('/activity', authenticate, async (req, res) => {
  try {
    const { limit = '20' } = req.query;
    
    const logs = await prisma.auditLog.findMany({
      where: {
        userId: req.user!.id,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        action: true,
        resourceType: true,
        description: true,
        createdAt: true,
        ipAddress: true,
      },
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Delete account (GDPR)
router.post('/delete-account', authenticate, async (req, res) => {
  try {
    const { password, reason } = req.body;
    
    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const bcrypt = await import('bcrypt');
    const validPassword = await bcrypt.compare(password, user.passwordHash || '');
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Soft delete user
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        deletedAt: new Date(),
        email: `deleted-${Date.now()}-${user.email}`, // Anonymize email
        passwordHash: null,
      },
    });
    
    // Revoke all sessions
    await prisma.session.deleteMany({
      where: { userId: req.user!.id },
    });
    
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.id },
      data: { revokedAt: new Date() },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
