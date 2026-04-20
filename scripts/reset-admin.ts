import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const usersSnap = await db.collection('users').where('email', '==', 'sayemf21@gmail.com').limit(1).get();
  if (usersSnap.empty) {
    console.log('User not found');
    return;
  }
  const user = usersSnap.docs[0];
  console.log('Found user:', user.data().email);
  const hashed = await bcrypt.hash('12345678', 10);
  await db.collection('users').doc(user.id).update({
    password: hashed,
    isPhoneVerified: true
  });
  console.log('Password reset to 12345678 and phone verified');
}

main().catch(console.error);
