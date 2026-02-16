
import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address.');
    process.exit(1);
  }

  console.log(`Attempting to delete user: ${email}...`);

  try {
    const user = await prisma.user.delete({
      where: { email },
    });
    console.log(`✅ User deleted successfully: ${user.name} (${user.email})`);
  } catch (error: any) {
    if (error.code === 'P2025') {
        console.log(`⚠️ User not found: ${email}`);
    } else {
        console.error('❌ Error deleting user:', error);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
