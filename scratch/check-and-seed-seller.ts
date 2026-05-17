import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function parsePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in .env.local');
  }

  const privateKey = parsePrivateKey(privateKeyRaw);

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = getFirestore();
  const email = 'seller@nilamit.test';
  const password = 'password123';

  const snap = await db.collection('users').where('email', '==', email).limit(1).get();

  if (snap.empty) {
    console.log(`User ${email} does not exist. Creating...`);
    const hashedPassword = await bcrypt.hash(password, 12);
    const userRef = db.collection('users').doc();
    const now = new Date();

    await userRef.set({
      id: userRef.id,
      name: 'E2E Test Seller',
      nameLowercase: 'e2e test seller',
      email,
      password: hashedPassword,
      isRetailer: false,
      isPhoneVerified: true,
      isVerifiedSeller: true,
      emailVerified: now,
      reputationScore: 100,
      rating: 5,
      ratingCount: 1,
      xp: 0,
      userLevel: 1,
      winningStreak: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`User ${email} successfully created!`);
  } else {
    console.log(`User ${email} already exists.`);
    const user = snap.docs[0].data();
    console.log(`User details:`, { id: user.id, isVerifiedSeller: user.isVerifiedSeller, isPhoneVerified: user.isPhoneVerified });

    // Ensure they are a verified seller so they can list auctions
    if (!user.isVerifiedSeller || !user.isPhoneVerified || !user.emailVerified) {
      console.log(`Updating user to be a verified seller...`);
      await snap.docs[0].ref.update({
        isVerifiedSeller: true,
        isPhoneVerified: true,
        emailVerified: new Date()
      });
      console.log(`User updated.`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
