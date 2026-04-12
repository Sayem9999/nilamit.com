import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Fault-tolerant initialization: Catches engine errors and prevents 500 crashes
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Attempting PrismaClient initialization. URL exists:', !!connectionString);
  
  try {
    return new PrismaClient({
      log: ['error'],
    });
  } catch (error) {
    console.error('[DB-FATAL] PrismaClient constructor failed. This usually means engine binary issues.', error);
    // Return a dummy object that mimics Prisma so components don't crash
    return null as unknown as PrismaClient;
  }
}

// Global persistence for dev/HMR
const getInternalClient = () => {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
};

/**
 * FAULT-TOLERANT PROXY
 * Ensures that if Prisma fails (engine crash, missing binaries), the app continues to serve
 * static pages and empty lists instead of showing a 500 error page.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getInternalClient();
    
    // If client failed to initialize or hits a fatal error
    if (!client) {
        console.warn(`[DB-SAFEGUARD] Blocked access to prisma.${String(prop)} because client is offline.`);
        
        // Return a dummy "find" function that returns empty results instead of crashing
        if (typeof prop === 'string' && (prop.startsWith('find') || prop === 'count')) {
            return async () => (prop === 'count' ? 0 : []);
        }
        
        // Throw a controlled error that components can catch via try/catch in actions
        return undefined;
    }

    try {
        const value = Reflect.get(client, prop, receiver);
        
        // Wrap model methods (findMany, findUnique, etc) to catch runtime Prisma errors
        if (typeof value === 'object' && value !== null && prop !== '$connect' && prop !== '$disconnect') {
            return new Proxy(value, {
                get(mTarget, mProp, mReceiver) {
                    const method = Reflect.get(mTarget, mProp, mReceiver);
                    if (typeof method === 'function') {
                        return async (...args: unknown[]) => {
                            try {
                                return await method.apply(mTarget, args);
                            } catch (e) {
                                console.error(`[DB-RUNTIME-ERROR] prisma.${String(prop)}.${String(mProp)} failed:`, e);
                                // Fallback empty states
                                if (String(mProp).startsWith('findMany')) return [];
                                if (String(mProp) === 'count') return 0;
                                throw e; // Let the action's try/catch handle specialized errors
                            }
                        };
                    }
                    return method;
                }
            });
        }
        
        return value;
    } catch (e) {
        console.error(`[DB-PROXY-FATAL] Failed to access prisma.${String(prop)}:`, e);
        return undefined;
    }
  }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as unknown as PrismaClient;
