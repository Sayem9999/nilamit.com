import type { PrismaClient } from '@prisma/client';

/**
 * Nilamit Database Client (v0.1.9)
 * 
 * ARCHITECTURE: Dynamic Isolation
 * This file uses a Proxy and Dynamic Imports to satisfy two conflicting requirements:
 * 1. FULL TYPE SAFETY: Code in Server Actions/Pages gets full Prisma autocomplete.
 * 2. EDGE COMPATIBILITY: The Vercel Middleware (Proxy) can import this file WITHOUT
 *    pulling the heavy Node.js Prisma engine into the Edge bundle.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization wrapper with dynamic import
async function getOrInitPrisma(): Promise<PrismaClient | undefined> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Dynamically initializing PrismaClient. URL exists:', !!connectionString);
  
  try {
    // We only import the runtime client and adapters at the very moment they're needed.
    const [{ PrismaClient: RuntimeClient }, { Pool }, { PrismaPg }] = await Promise.all([
      import('@prisma/client'),
      import('pg'),
      import('@prisma/adapter-pg')
    ]);

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    globalForPrisma.prisma = new RuntimeClient({ adapter });
    return globalForPrisma.prisma;
  } catch (error) {
    console.error('[DB-FATAL] Dynamic PrismaClient initialization failed:', error);
    return undefined;
  }
}

/**
 * TYPE-SAFE ASYNC PROXY
 * This object is exported as 'prisma' and is treated as a PrismaClient by the compiler.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    // Utility properties that shouldn't trigger DB initialization
    if (prop === '$$typeof' || prop === 'constructor' || prop === 'then' || typeof prop === 'symbol') {
        return undefined;
    }

    // Return a proxy that handles both direct calls ($connect) and model access (user.findMany)
    return new Proxy(() => {}, {
      // Handles direct function calls on prisma (e.g. prisma.$transaction)
      async apply(mTarget, thisArg, args) {
        const client = await getOrInitPrisma();
        if (!client) return null;
        const method = Reflect.get(client, prop);
        if (typeof method === 'function') {
            return method.apply(client, args);
        }
        return method;
      },
      // Handles model access (e.g. prisma.user.findMany)
      get(mTarget, mProp) {
        return async (...args: unknown[]) => {
          const client = await getOrInitPrisma();
          if (!client) {
              console.warn(`[DB-OFFLINE] prisma.${String(prop)}.${String(mProp)} blocked.`);
              if (String(mProp).startsWith('findMany')) return [];
              if (String(mProp) === 'count') return 0;
              return null;
          }
          
          try {
            const model = Reflect.get(client, prop);
            const method = Reflect.get(model, mProp);
            if (typeof method === 'function') {
                return await method.apply(model, args);
            }
            return method;
          } catch (e) {
            console.error(`[DB-RUNTIME-ERR] prisma.${String(prop)}.${String(mProp)} failed:`, e);
            if (String(mProp).startsWith('findMany')) return [];
            return null;
          }
        };
      }
    });
  }
});

// In development, the proxy is already exported and handles its own lifecycle.
// Lazy initialization in getOrInitPrisma manages the singleton.
