import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Nilamit Database Client (v0.2.1)
 * 
 * ARCHITECTURE: Robust Singleton Pool with AdapterPg
 * Optimized for Supabase/Vercel connectivity.
 */

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient singleton with Adapter...');
  
  if (!connectionString) {
    console.warn('[DB-WARN] DATABASE_URL is missing. DB will be offline.');
    return new PrismaClient();
  }

  try {
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false, // development usually doesn't need SSL or uses local certs
      max: 30,                     // Handle 500+ concurrent bids (was 10)
      idleTimeoutMillis: 30000,    // Close idle connections after 30s
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,      // Keep pool alive between requests
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ 
      adapter,
      log: ['error', 'warn']
    });
  } catch (error) {
    console.error('[DB-FATAL] Failed to initialize Prisma Client:', error);
    return new PrismaClient();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
