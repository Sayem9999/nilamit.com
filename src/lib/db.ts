import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization wrapper to prevent build-time crashes
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  console.log('[DB] Initializing PrismaClient. DATABASE_URL present:', !!connectionString);
  
  return new PrismaClient({
    log: ['error'],
  });
}

// Using a Proxy to delay actual PrismaClient instantiation until the first property access.
// This ensures that the build process can import 'prisma' without triggering a database 
// connection or engine initialization that might fail in restricted build environments.
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop, receiver);
  }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as unknown as PrismaClient;
