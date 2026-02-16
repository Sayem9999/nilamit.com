import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient. DATABASE_URL present:', !!connectionString);
  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is missing in production environment variables!');
    }
    
    console.error('[DB] DATABASE_URL is missing! Returning dummy client.');
    // Return a client that will error on actual DB calls but won't crash on import
    // This allows the app to boot for frontend-only pages without a DB connection
    const pool = new pg.Pool({ connectionString: 'postgresql://localhost:5432/nilamit_dev' });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: ['error', 'warn'],
    });
  }
  
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
