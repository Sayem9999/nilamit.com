import { prisma } from './src/lib/db.js';

async function checkUsers() {
  try {
    const count = await prisma.user.count();
    console.log(`[CHECK] Total users in DB: ${count}`);
    
    if (count > 0) {
      const users = await prisma.user.findMany({
        take: 5,
        select: { email: true, isPhoneVerified: true }
      });
      console.log('[CHECK] Sample users:', JSON.stringify(users, null, 2));
    }
  } catch (error) {
    console.error('[CHECK-ERROR] Prisma failed to reach DB:', error);
  } finally {
    process.exit(0);
  }
}

checkUsers();
