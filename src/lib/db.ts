import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient. DATABASE_URL present:', !!connectionString);
  
  // If connectionString is missing, we can log a warning, 
  // but we should still return a client instance to avoid build failures.
  if (!connectionString && process.env.NODE_ENV === 'production') {
    console.warn('[DB] WARNING: DATABASE_URL is missing during build phase.');
  }
  
  // Standard initialization: Prisma will automatically use the DATABASE_URL environment variable.
  // We avoid passing the 'datasources' object to sidestep Prisma 7 TypeScript constructor quirks.
  return new PrismaClient({
    log: ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
