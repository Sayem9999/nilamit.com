import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient. DATABASE_URL present:', !!connectionString);
  
  // Standard initialization without the driver adapter
  // This uses the more stable Prisma Library Engine
  return new PrismaClient({
    log: ['error'],
    ...(connectionString ? {
      datasources: {
        db: {
          url: connectionString
        }
      }
    } : {})
  });
}

// Ensure the export doesn't crash during build-time collection
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
