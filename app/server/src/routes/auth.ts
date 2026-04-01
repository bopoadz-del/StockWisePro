import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { prisma } from '../config/database';
import { config } from '../config';
import { authenticate, requireMFA } from '../middleware/auth';
import { audit } from '../middleware/auditLogger';
import { strictRateLimiter } from '../middleware/rateLimiter';
import { generateToken, hashToken } from '../utils/encryption';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  organizationName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaCode: z.string().length(6).optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

const setupMFASchema = z.object({
  code: z.string().length(6),
});

// Generate JWT tokens
function generateTokens(userId: string, email: string, organizationId: string, role: string, permissions: string[], mfaVerified: boolean) {
  const accessToken = jwt.sign(
    {
      userId,
      email,
      organizationId,
      role,
      permissions: [...permissions, ...(mfaVerified ? [] : ['pending_mfa'])],
      type: 'access',
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn as any,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }
  );

  const refreshToken = generateToken(64);

  return { accessToken, refreshToken };
}

// Register
router.post('/register', strictRateLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email, deletedAt: null },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, config.security.bcryptRounds);

    // Create organization and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug: `${data.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
          plan: 'FREE',
          subscriptionStatus: 'TRIAL',
          subscriptionExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        },
      });

      // Create user as owner
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          organizationId: organization.id,
          role: 'OWNER',
          status: 'ACTIVE',
          emailVerified: true, // TODO: Send verification email
        },
      });

      return { organization, user };
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      result.user.id,
      result.user.email,
      result.organization.id,
      result.user.role,
      [],
      true
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          plan: result.organization.plan,
        },
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', strictRateLimiter, audit.loginFailed(), async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findFirst({
      where: { email: data.email, deletedAt: null },
      include: { organization: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(401).json({
        error: 'Account locked',
        lockedUntil: user.lockedUntil,
        message: 'Too many failed login attempts. Please try again later.',
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(data.password, user.passwordHash || '');

    if (!validPassword) {
      // Increment failed attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updates: any = { failedLoginAttempts: failedAttempts };

      if (failedAttempts >= config.security.maxLoginAttempts) {
        updates.lockedUntil = new Date(Date.now() + config.security.lockoutDurationMinutes * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check MFA
    if (user.mfaEnabled) {
      if (!data.mfaCode) {
        return res.status(403).json({
          error: 'MFA required',
          code: 'MFA_REQUIRED',
          message: 'Please provide your MFA code',
        });
      }

      const mfaResult = verifySync({ token: data.mfaCode, secret: user.mfaSecret || '' });
      const validMFA = mfaResult.valid;

      if (!validMFA) {
        return res.status(401).json({ error: 'Invalid MFA code' });
      }
    }

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.organizationId,
      user.role,
      user.permissions,
      true
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          plan: user.organization.plan,
        },
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);

    const hashedToken = hashToken(refreshToken);

    // Find and validate refresh token
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: hashedToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { organization: true } } },
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.organizationId,
      storedToken.user.role,
      storedToken.user.permissions,
      !storedToken.user.mfaEnabled
    );

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        token: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { organization: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      permissions: user.permissions,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      timezone: user.timezone,
      locale: user.locale,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        plan: user.organization.plan,
        subscriptionStatus: user.organization.subscriptionStatus,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update profile
router.patch('/me', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authenticate, audit.passwordChanged(), async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(data.currentPassword, user.passwordHash || '');

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check password history
    const passwordHistory = user.passwordHistory || [];
    for (const oldHash of passwordHistory) {
      const isOldPassword = await bcrypt.compare(data.newPassword, oldHash);
      if (isOldPassword) {
        return res.status(400).json({ error: 'Cannot reuse a previous password' });
      }
    }

    // Hash new password
    const newHash = await bcrypt.hash(data.newPassword, config.security.bcryptRounds);

    // Update password and history
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        passwordHistory: {
          set: [newHash, ...passwordHistory].slice(0, config.security.passwordHistorySize),
        },
      },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Setup MFA
router.post('/mfa/setup', authenticate, async (req, res) => {
  try {
    // Generate secret
    const secret = generateSecret();

    // Generate QR code URL
    const otpauth = generateURI({
      secret,
      label: req.user!.email,
      issuer: 'AlphaSpectrum',
    });

    // Temporarily store secret (will be confirmed)
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { mfaSecret: secret },
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    res.json({
      secret,
      otpauth,
      backupCodes,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Failed to setup MFA' });
  }
});

// Verify and enable MFA
router.post('/mfa/verify', authenticate, async (req, res) => {
  try {
    const data = setupMFASchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user?.mfaSecret) {
      return res.status(400).json({ error: 'MFA setup not initiated' });
    }

    const mfaResult = verifySync({ token: data.code, secret: user.mfaSecret });
    const valid = mfaResult.valid;

    if (!valid) {
      return res.status(400).json({ error: 'Invalid MFA code' });
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { mfaEnabled: true },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

// Disable MFA
router.post('/mfa/disable', authenticate, async (req, res) => {
  try {
    const { password } = z.object({ password: z.string() }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash || '');

    if (!validPassword) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

export default router;
