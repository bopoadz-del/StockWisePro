import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { UserRole, UserStatus } from '@prisma/client';

// JWT token payload
interface JWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: UserRole;
  permissions: string[];
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

// Extended request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        permissions: string[];
        mfaEnabled: boolean;
        mfaVerified: boolean;
      };
      organization?: {
        id: string;
        name: string;
        plan: string;
        settings: any;
      };
      apiKey?: {
        id: string;
        name: string;
        permissions: string[];
        organizationId: string;
      };
    }
  }
}

/**
 * Extract token from request headers
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check X-API-Key header
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `apikey:${apiKey}`;
  }
  
  return null;
}

/**
 * Main authentication middleware
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Handle API key authentication
    if (token.startsWith('apikey:')) {
      return await authenticateApiKey(req, res, next, token.substring(7));
    }
    
    // Handle JWT authentication
    return await authenticateJWT(req, res, next, token);
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Authenticate using JWT
 */
async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
  token: string
) {
  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organization: true,
      },
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      return res.status(401).json({ 
        error: 'Account inactive',
        status: user.status,
      });
    }
    
    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(401).json({
        error: 'Account locked',
        lockedUntil: user.lockedUntil,
      });
    }
    
    // Check organization
    if (!user.organization) {
      return res.status(401).json({ error: 'Organization not found' });
    }
    
    // Check subscription status
    if (user.organization.subscriptionStatus === 'SUSPENDED') {
      return res.status(403).json({ 
        error: 'Subscription suspended',
        message: 'Please contact support to reactivate your account',
      });
    }
    
    // Attach user and organization to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: decoded.permissions.includes('mfa_verified'),
    };
    
    req.organization = {
      id: user.organization.id,
      name: user.organization.name,
      plan: user.organization.plan,
      settings: user.organization.settings,
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    throw error;
  }
}

/**
 * Authenticate using API key
 */
async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
  apiKey: string
) {
  try {
    const { hashApiKey } = await import('../utils/encryption');
    const keyHash = hashApiKey(apiKey);
    
    // Look up API key
    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        organization: true,
      },
    });
    
    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Check if key is active
    if (keyRecord.revokedAt) {
      return res.status(401).json({ error: 'API key revoked' });
    }
    
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }
    
    // Check IP whitelist
    if (keyRecord.allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      if (!keyRecord.allowedIps.includes(clientIp)) {
        return res.status(401).json({ error: 'IP address not allowed' });
      }
    }
    
    // Update usage
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
    
    // Attach API key and organization to request
    req.apiKey = {
      id: keyRecord.id,
      name: keyRecord.name,
      permissions: keyRecord.permissions,
      organizationId: keyRecord.organizationId,
    };
    
    req.organization = {
      id: keyRecord.organization.id,
      name: keyRecord.organization.name,
      plan: keyRecord.organization.plan,
      settings: keyRecord.organization.settings,
    };
    
    // Create user context from API key
    req.user = {
      id: keyRecord.createdBy,
      email: 'api@system.local',
      role: UserRole.API,
      permissions: keyRecord.permissions,
      mfaEnabled: false,
      mfaVerified: true,
    };
    
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication (doesn't require auth but populates if present)
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next();
    }
    
    return await authenticate(req, res, next);
  } catch {
    // Continue without auth
    next();
  }
}

/**
 * Role-based access control middleware
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Owner and Admin have access to everything
    if (req.user.role === UserRole.OWNER || req.user.role === UserRole.ADMIN) {
      return next();
    }
    
    // Check specific role
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role,
      });
    }
    
    next();
  };
}

/**
 * Permission-based access control middleware
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Owner has all permissions
    if (req.user.role === UserRole.OWNER) {
      return next();
    }
    
    // Check explicit permissions
    const hasPermissions = requiredPermissions.every(p => 
      req.user!.permissions.includes(p)
    );
    
    if (!hasPermissions) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredPermissions,
      });
    }
    
    next();
  };
}

/**
 * Require MFA verification
 */
export function requireMFA(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.mfaEnabled && !req.user.mfaVerified) {
    return res.status(403).json({ 
      error: 'MFA verification required',
      code: 'MFA_REQUIRED',
    });
  }
  
  next();
}

/**
 * Check if user belongs to specific organization
 */
export function requireOrganization(organizationId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organization) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.organization.id !== organizationId) {
      return res.status(403).json({ error: 'Access denied for this organization' });
    }
    
    next();
  };
}

// Export role hierarchy for permission checks
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER]: 100,
  [UserRole.ADMIN]: 90,
  [UserRole.MANAGER]: 70,
  [UserRole.ANALYST]: 50,
  [UserRole.MEMBER]: 30,
  [UserRole.VIEWER]: 10,
  [UserRole.API]: 0,
};

/**
 * Check if role has minimum required level
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
