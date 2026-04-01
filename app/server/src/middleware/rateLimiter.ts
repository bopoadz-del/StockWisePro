import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { config } from '../config';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

// Plan-based rate limits
const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  FREE: { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100/hour
  STARTER: { windowMs: 60 * 60 * 1000, maxRequests: 1000 }, // 1000/hour
  PROFESSIONAL: { windowMs: 60 * 60 * 1000, maxRequests: 10000 }, // 10K/hour
  ENTERPRISE: { windowMs: 60 * 60 * 1000, maxRequests: 100000 }, // 100K/hour
};

// Endpoint-specific limits (stricter for expensive operations)
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  'POST:/api/stocks/bulk': { windowMs: 60 * 1000, maxRequests: 10 }, // 10/minute
  'POST:/api/portfolios/backtest': { windowMs: 60 * 1000, maxRequests: 5 }, // 5/minute
  'POST:/api/experiments/run': { windowMs: 60 * 1000, maxRequests: 10 }, // 10/minute
};

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  window: number;
}

/**
 * Generate rate limit key based on request
 */
function getRateLimitKey(req: Request, prefix: string = 'ratelimit'): string {
  // Prefer API key for identification
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `${prefix}:api:${apiKey}`;
  }
  
  // Fall back to user ID if authenticated
  const userId = req.user?.id;
  if (userId) {
    return `${prefix}:user:${userId}`;
  }
  
  // Fall back to IP address (for unauthenticated requests)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${prefix}:ip:${ip}`;
}

/**
 * Check and update rate limit in Redis
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const windowKey = `${key}:${windowStart}`;
  
  const pipeline = redis.pipeline();
  pipeline.incr(windowKey);
  pipeline.expire(windowKey, Math.ceil(config.windowMs / 1000));
  
  const results = await pipeline.exec();
  const current = (results?.[0]?.[1] as number) || 1;
  
  const allowed = current <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - current);
  const reset = new Date(windowStart + config.windowMs);
  
  return {
    allowed,
    info: {
      limit: config.maxRequests,
      remaining,
      reset,
      window: config.windowMs,
    },
  };
}

/**
 * Main rate limiting middleware
 */
export function createRateLimiter(options?: Partial<RateLimitConfig>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get organization plan (default to FREE)
      const plan = req.organization?.plan || 'FREE';
      const planConfig = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
      
      // Check for endpoint-specific limits
      const endpointKey = `${req.method}:${req.route?.path || req.path}`;
      const endpointConfig = ENDPOINT_LIMITS[endpointKey];
      
      // Use the most restrictive limit
      const effectiveConfig = endpointConfig || {
        ...planConfig,
        ...options,
      };
      
      const key = getRateLimitKey(req);
      const { allowed, info } = await checkRateLimit(key, effectiveConfig);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', info.limit.toString());
      res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(info.reset.getTime() / 1000).toString());
      
      if (!allowed) {
        // Log rate limit violation for security monitoring
        console.warn(`Rate limit exceeded: ${key}`, {
          path: req.path,
          method: req.method,
          organizationId: req.organization?.id,
          userId: req.user?.id,
        });
        
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((info.reset.getTime() - Date.now()) / 1000),
        });
      }
      
      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

/**
 * Stricter rate limiter for sensitive endpoints (login, password reset)
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts
});

/**
 * API key rate limiter with higher limits
 */
export const apiKeyRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey) {
      return next(); // No API key, skip this limiter
    }
    
    const key = `ratelimit:apikey:${apiKey.id}`;
    const limitConfig: RateLimitConfig = {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: (apiKey as any).rateLimit || 1000,
    };
    
    const { allowed, info } = await checkRateLimit(key, limitConfig);
    
    res.setHeader('X-RateLimit-Limit', info.limit.toString());
    res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(info.reset.getTime() / 1000).toString());
    
    if (!allowed) {
      return res.status(429).json({
        error: 'API rate limit exceeded',
        message: 'Your API key has exceeded the hourly quota.',
        retryAfter: Math.ceil((info.reset.getTime() - Date.now()) / 1000),
      });
    }
    
    next();
  } catch (error) {
    console.error('API key rate limiter error:', error);
    next();
  }
};

/**
 * Webhook rate limiter to prevent abuse
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 1 per second average
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: RateLimitInfo;
    }
  }
}
