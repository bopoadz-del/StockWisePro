import { PrismaClient } from '@prisma/client';
import { config } from './index';

// Prisma client singleton
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: config.isDevelopment 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

if (config.isDevelopment) {
  globalForPrisma.prisma = prisma;
}

// Check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Disconnect from database
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// Prisma middleware for soft deletes and audit logging
prisma.$use(async (params, next) => {
  // Soft delete middleware
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }
  
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    if (params.args.data) {
      params.args.data.deletedAt = new Date();
    } else {
      params.args.data = { deletedAt: new Date() };
    }
  }

  return next(params);
});
