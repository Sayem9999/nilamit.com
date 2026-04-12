import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient. DATABASE_URL present:', !!connectionString);
  
  if (!connectionString && process.env.NODE_ENV === 'production') {
    console.warn('[DB] WARNING: DATABASE_URL is missing during build phase. Falling back to dummy client.');
    // In production build, we still want a client instance so the build succeeds
    return new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  
  // Standard initialization: Prisma will automatically use process.env.DATABASE_URL
  return new PrismaClient({
    log: ['error'], 
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
