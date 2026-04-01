import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuditAction } from '@prisma/client';
import { maskSensitiveData } from '../utils/encryption';

interface AuditLogOptions {
  action: AuditAction;
  resourceType: string;
  getResourceId?: (req: Request) => string | undefined;
  getDescription?: (req: Request) => string;
  getMetadata?: (req: Request) => Record<string, any> | undefined;
  includeBody?: boolean;
  sensitiveFields?: string[];
}

/**
 * Create audit log middleware
 */
export function auditLog(options: AuditLogOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Process after response is sent
    res.on('finish', () => {
      createAuditLog(req, res, options).catch(console.error);
    });
    
    next();
  };
}

/**
 * Create audit log entry
 */
async function createAuditLog(
  req: Request,
  res: Response,
  options: AuditLogOptions
) {
  try {
    const organizationId = req.organization?.id;
    const userId = req.user?.id;
    
    // Skip if no organization context (shouldn't happen for protected routes)
    if (!organizationId) {
      return;
    }
    
    const resourceId = options.getResourceId?.(req);
    const description = options.getDescription?.(req) || getDefaultDescription(req, options);
    
    // Build metadata
    let metadata: Record<string, any> = {
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
    };
    
    // Add request body if enabled (with sensitive data masking)
    if (options.includeBody && req.body) {
      metadata.requestBody = sanitizeBody(req.body, options.sensitiveFields);
    }
    
    // Add custom metadata
    const customMetadata = options.getMetadata?.(req);
    if (customMetadata) {
      metadata = { ...metadata, ...customMetadata };
    }
    
    // Add query params for GET requests
    if (req.method === 'GET' && Object.keys(req.query).length > 0) {
      metadata.query = req.query;
    }
    
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: options.action,
        resourceType: options.resourceType,
        resourceId,
        description,
        metadata,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'] as string,
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Get default description based on action and request
 */
function getDefaultDescription(req: Request, options: AuditLogOptions): string {
  const userEmail = req.user?.email || 'Unknown';
  const action = options.action.toLowerCase().replace(/_/g, ' ');
  const resource = options.resourceType.toLowerCase();
  
  return `${userEmail} performed ${action} on ${resource}`;
}

/**
 * Sanitize request body for audit logs
 */
function sanitizeBody(body: any, sensitiveFields?: string[]): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  const fieldsToMask = [...(sensitiveFields || []), 'password', 'token', 'secret', 'apiKey', 'creditCard'];
  
  for (const field of fieldsToMask) {
    if (field in sanitized) {
      const value = sanitized[field];
      if (typeof value === 'string') {
        sanitized[field] = maskSensitiveData(value);
      } else if (Array.isArray(value)) {
        sanitized[field] = value.map(v => typeof v === 'string' ? maskSensitiveData(v) : '***');
      } else {
        sanitized[field] = '***';
      }
    }
  }
  
  return sanitized;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Helper to log specific actions programmatically
 */
export async function logAuditEvent(
  organizationId: string,
  action: AuditAction,
  options: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    description?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: options.userId,
        action,
        resourceType: options.resourceType || 'system',
        resourceId: options.resourceId,
        description: options.description || `System event: ${action}`,
        metadata: options.metadata,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Pre-configured audit loggers for common operations

export const audit: Record<string, any> = {
  // Auth operations
  login: () => auditLog({
    action: AuditAction.LOGIN,
    resourceType: 'session',
    getDescription: (req) => `User ${req.user?.email} logged in`,
  }),
  
  loginFailed: () => auditLog({
    action: AuditAction.LOGIN_FAILED,
    resourceType: 'session',
    getDescription: (req) => `Failed login attempt for ${req.body.email}`,
    getMetadata: (req) => ({ email: req.body.email }),
  }),
  
  logout: () => auditLog({
    action: AuditAction.LOGOUT,
    resourceType: 'session',
    getDescription: (req) => `User ${req.user?.email} logged out`,
  }),
  
  passwordChanged: () => auditLog({
    action: AuditAction.PASSWORD_CHANGED,
    resourceType: 'user',
    getDescription: (req) => `User ${req.user?.email} changed password`,
  }),
  
  mfaEnabled: () => auditLog({
    action: AuditAction.MFA_ENABLED,
    resourceType: 'user',
    getDescription: (req) => `MFA enabled for user ${req.user?.email}`,
  }),
  
  mfaDisabled: () => auditLog({
    action: AuditAction.MFA_DISABLED,
    resourceType: 'user',
    getDescription: (req) => `MFA disabled for user ${req.user?.email}`,
  }),
  
  // User management
  userCreated: () => auditLog({
    action: AuditAction.USER_CREATED,
    resourceType: 'user',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `User ${req.body.email} created by ${req.user?.email}`,
  }),
  
  userUpdated: () => auditLog({
    action: AuditAction.USER_UPDATED,
    resourceType: 'user',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `User ${req.params.id} updated by ${req.user?.email}`,
  }),
  
  userDeleted: () => auditLog({
    action: AuditAction.USER_DELETED,
    resourceType: 'user',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `User ${req.params.id} deleted by ${req.user?.email}`,
  }),
  
  userInvited: () => auditLog({
    action: AuditAction.USER_INVITED,
    resourceType: 'user',
    getDescription: (req) => `User ${req.body.email} invited by ${req.user?.email}`,
  }),
  
  // API key operations
  apiKeyCreated: () => auditLog({
    action: AuditAction.API_KEY_CREATED,
    resourceType: 'api_key',
    getDescription: (req) => `API key "${req.body.name}" created by ${req.user?.email}`,
  }),
  
  apiKeyRevoked: () => auditLog({
    action: AuditAction.API_KEY_REVOKED,
    resourceType: 'api_key',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `API key ${req.params.id} revoked by ${req.user?.email}`,
    getMetadata: (req) => ({ reason: req.body.reason }),
  }),
  
  // Webhook operations
  webhookCreated: () => auditLog({
    action: AuditAction.WEBHOOK_CREATED,
    resourceType: 'webhook',
    getDescription: (req) => `Webhook "${req.body.name}" created by ${req.user?.email}`,
  }),
  
  webhookUpdated: () => auditLog({
    action: AuditAction.WEBHOOK_UPDATED,
    resourceType: 'webhook',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Webhook ${req.params.id} updated by ${req.user?.email}`,
  }),
  
  webhookDeleted: () => auditLog({
    action: AuditAction.WEBHOOK_DELETED,
    resourceType: 'webhook',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Webhook ${req.params.id} deleted by ${req.user?.email}`,
  }),
  
  orgUpdated: () => auditLog({
    action: AuditAction.ORG_UPDATED,
    resourceType: 'organization',
    getDescription: (req) => `Organization updated by ${req.user?.email}`,
  }),
  
  orgSettingsChanged: () => auditLog({
    action: AuditAction.ORG_SETTINGS_CHANGED,
    resourceType: 'organization',
    getDescription: (req) => `Organization settings changed by ${req.user?.email}`,
  }),
  
  // Security events
  permissionDenied: () => auditLog({
    action: AuditAction.PERMISSION_DENIED,
    resourceType: 'access_control',
    getDescription: (req) => `Permission denied for ${req.user?.email} accessing ${req.path}`,
    getMetadata: (req: any) => ({ requiredPermission: req.requiredPermission }),
  }),
  
  rateLimited: () => auditLog({
    action: AuditAction.RATE_LIMITED,
    resourceType: 'rate_limit',
    getDescription: (req) => `Rate limit exceeded by ${req.user?.email || req.ip}`,
    getMetadata: (req: any) => ({ rateLimitKey: req.rateLimitKey }),
  }),
};

export default auditLog;
