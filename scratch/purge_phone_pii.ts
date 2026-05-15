import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function purge() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('Missing Firebase credentials in .env');
    process.exit(1);
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = getFirestore();
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  console.log(`Found ${snapshot.size} users. Starting purge...`);

  let count = 0;
  const batchSize = 400;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.phone || data.phoneNumber || data.isPhoneVerified !== undefined) {
      batch.update(doc.ref, {
        phone: FieldValue.delete(),
        phoneNumber: FieldValue.delete(),
        isPhoneVerified: FieldValue.delete(),
      });
      count++;
    }

    if (count % batchSize === 0 && count > 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`Purged ${count} users...`);
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }

  console.log(`Successfully purged phone PII from ${count} user documents.`);
}

purge().catch(console.error);
