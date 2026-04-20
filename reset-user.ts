
import 'dotenv/config';
import { db } from './src/lib/db';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address.');
    process.exit(1);
  }

  console.log(`Attempting to delete user: ${email}...`);

  try {
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (usersSnap.empty) {
        console.log(`⚠️ User not found: ${email}`);
        return;
    }
    const user = usersSnap.docs[0];
    await db.collection('users').doc(user.id).delete();
    console.log(`✅ User deleted successfully: ${user.data().name} (${user.data().email})`);
  } catch (error: unknown) {
    console.error('❌ Error deleting user:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
