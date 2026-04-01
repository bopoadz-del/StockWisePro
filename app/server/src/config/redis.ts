import Redis from 'ioredis';
import { config } from './index';

// Redis client singleton
let redis: Redis;

export function initializeRedis(): Redis {
  if (redis) {
    return redis;
  }
  
  const redisUrl = config.redis.url || process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('REDIS_URL not set. Using in-memory fallback (NOT for production)');
    // Return mock Redis for development
    return createMockRedis();
  }
  
  redis = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  
  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });
  
  redis.on('error', (error) => {
    console.error('Redis error:', error);
  });
  
  return redis;
}

export function getRedis(): Redis {
  if (!redis) {
    return initializeRedis();
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null as any;
  }
}

// Mock Redis for development without Redis server
function createMockRedis(): Redis {
  const store = new Map<string, any>();
  const expirations = new Map<string, NodeJS.Timeout>();
  
  const mockRedis = {
    async get(key: string): Promise<string | null> {
      return store.get(key) || null;
    },
    
    async set(key: string, value: string, ...args: any[]): Promise<string> {
      store.set(key, value);
      
      // Handle EX (expire) argument
      const exIndex = args.indexOf('EX');
      if (exIndex !== -1 && args[exIndex + 1]) {
        const ttl = args[exIndex + 1] * 1000;
        if (expirations.has(key)) {
          clearTimeout(expirations.get(key));
        }
        expirations.set(key, setTimeout(() => {
          store.delete(key);
          expirations.delete(key);
        }, ttl));
      }
      
      return 'OK';
    },
    
    async del(...keys: string[]): Promise<number> {
      let count = 0;
      for (const key of keys) {
        if (store.has(key)) {
          store.delete(key);
          if (expirations.has(key)) {
            clearTimeout(expirations.get(key));
            expirations.delete(key);
          }
          count++;
        }
      }
      return count;
    },
    
    async incr(key: string): Promise<number> {
      const current = parseInt(store.get(key) || '0', 10);
      const next = current + 1;
      store.set(key, next.toString());
      return next;
    },
    
    async expire(key: string, seconds: number): Promise<number> {
      if (!store.has(key)) return 0;
      
      if (expirations.has(key)) {
        clearTimeout(expirations.get(key));
      }
      
      expirations.set(key, setTimeout(() => {
        store.delete(key);
        expirations.delete(key);
      }, seconds * 1000));
      
      return 1;
    },
    
    async ttl(key: string): Promise<number> {
      // Simplified - returns -1 if key exists, -2 if not
      return store.has(key) ? -1 : -2;
    },
    
    async exists(...keys: string[]): Promise<number> {
      let count = 0;
      for (const key of keys) {
        if (store.has(key)) count++;
      }
      return count;
    },
    
    async ping(): Promise<string> {
      return 'PONG';
    },
    
    pipeline() {
      const commands: Array<() => Promise<any>> = [];
      
      return {
        incr(key: string) {
          commands.push(() => mockRedis.incr(key));
          return this;
        },
        expire(key: string, seconds: number) {
          commands.push(() => mockRedis.expire(key, seconds));
          return this;
        },
        set(key: string, value: string, ...args: any[]) {
          commands.push(() => mockRedis.set(key, value, ...args));
          return this;
        },
        get(key: string) {
          commands.push(() => mockRedis.get(key));
          return this;
        },
        del(...keys: string[]) {
          commands.push(() => mockRedis.del(...keys));
          return this;
        },
        async exec(): Promise<any[]> {
          const results = await Promise.allSettled(commands.map(cmd => cmd()));
          return results.map(r => 
            r.status === 'fulfilled' ? [null, r.value] : [r.reason, null]
          );
        },
      };
    },
    
    async quit(): Promise<void> {
      store.clear();
      for (const timeout of expirations.values()) {
        clearTimeout(timeout);
      }
      expirations.clear();
    },
    
    // Event emitter stubs
    on(event: string, handler: Function) {
      if (event === 'connect') {
        setImmediate(() => handler());
      }
      return this;
    },
  } as unknown as Redis;
  
  console.log('Using in-memory Redis mock (development only)');
  return mockRedis;
}

export { redis };
