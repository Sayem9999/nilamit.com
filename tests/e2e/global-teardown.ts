/**
 * Playwright global teardown — deletes all data the e2e run created in the live
 * database. Scoped strictly to the `@nilamit.test` email domain (test-only), so
 * it can never touch real users/listings.
 *
 * Removes: test users, their auctions (by sellerId/winnerId), and those
 * auctions' bids, escrowTransactions, conversations, and history_logs.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// See global-setup: trim env in place so firebase-admin's auto-detected
// projectId (used in gRPC metadata) has no trailing newline from CI secrets.
for (const k of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL']) {
  if (process.env[k]) process.env[k] = process.env[k]!.trim();
}

function parsePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

export default async function globalTeardown() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.warn('[e2e teardown] Missing FIREBASE_* env — skipping cleanup.');
    return;
  }
  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey: parsePrivateKey(privateKeyRaw) }) });
  }
  const db = getFirestore();

  // Test users are created with @nilamit.test emails. Firestore has no
  // "endsWith" query, so fetch a bounded recent slice and filter in memory.
  const usersSnap = await db.collection('users')
    .orderBy('createdAt', 'desc').limit(500).get();
  const testUserIds = usersSnap.docs
    .filter((d) => String(d.data().email || '').endsWith('@nilamit.test'))
    .map((d) => d.id);

  if (testUserIds.length === 0) {
    console.log('[e2e teardown] no @nilamit.test users found.');
    return;
  }

  const idChunks: string[][] = [];
  for (let i = 0; i < testUserIds.length; i += 10) idChunks.push(testUserIds.slice(i, i + 10));

  const auctionIds = new Set<string>();
  for (const chunk of idChunks) {
    for (const field of ['sellerId', 'winnerId']) {
      const snap = await db.collection('auctions').where(field, 'in', chunk).get();
      snap.docs.forEach((d) => auctionIds.add(d.id));
    }
  }

  let removed = 0;
  for (const aId of auctionIds) {
    // bids
    const bids = await db.collection('bids').where('auctionId', '==', aId).get();
    for (const b of bids.docs) { await b.ref.delete(); removed++; }
    // history_logs subcollection
    const logs = await db.collection('auctions').doc(aId).collection('history_logs').get();
    for (const l of logs.docs) { await l.ref.delete(); removed++; }
    // escrow + conversation (doc id == auctionId)
    await db.collection('escrowTransactions').doc(aId).delete().catch(() => {});
    await db.collection('conversations').doc(aId).delete().catch(() => {});
    await db.collection('auctions').doc(aId).delete();
    removed++;
  }
  for (const uId of testUserIds) { await db.collection('users').doc(uId).delete(); removed++; }

  console.log(`[e2e teardown] removed ${testUserIds.length} test users, ${auctionIds.size} auctions, ${removed} docs total.`);
}
