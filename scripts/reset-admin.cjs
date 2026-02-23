const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'sayemf21@gmail.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('Found user:', user.email);
  const hashed = await bcrypt.hash('12345678', 10);
  await prisma.user.update({
    where: { email: 'sayemf21@gmail.com' },
    data: { password: hashed, isPhoneVerified: true }
  });
  console.log('Password reset to 12345678 and phone verified');
}

main().catch(console.error).finally(() => prisma.$disconnect());
