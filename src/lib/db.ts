import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient. DATABASE_URL present:', !!connectionString);
  
  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[DB] WARNING: DATABASE_URL is missing during build phase. Falling back to dummy client.');
    }
    
    console.error('[DB] DATABASE_URL is missing! Returning dummy client.');
    return new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: ['error'], // Optimized: do not log queries, even in dev
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
