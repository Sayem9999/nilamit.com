/**
 * Playwright global setup — seeds a verified test bidder + a test seller + an
 * ACTIVE auction directly via firebase-admin, so the e2e gate can test the
 * real browser login→bid path without the brittle register/create-listing UIs.
 *
 * All data is @nilamit.test / __smokeTest and removed by global-teardown.
 * Writes the credentials + auction id to tests/e2e/.seed.json (gitignored).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function parsePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----')) key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  return key;
}

export default async function globalSetup() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('[e2e setup] Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  }
  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey: parsePrivateKey(privateKeyRaw) }) });
  }
  const db = getFirestore();

  const now = new Date();
  const password = `E2e!${Date.now().toString(36)}`;
  const hash = await bcrypt.hash(password, 10);
  const bidderEmail = `e2e_bidder_${Date.now()}@nilamit.test`;
  const sellerId = `e2e_seller_${Date.now()}`;
  const bidderId = `e2e_bidder_${Date.now()}`;
  const auctionId = `e2e_auc_${Date.now()}`;

  await db.collection('users').doc(sellerId).set({
    id: sellerId, name: 'E2E Seller', email: `${sellerId}@nilamit.test`,
    emailVerified: now, isBanned: false, createdAt: now, __smokeTest: true,
  });
  await db.collection('users').doc(bidderId).set({
    id: bidderId, name: 'E2E Bidder', email: bidderEmail, password: hash,
    emailVerified: now, isBanned: false, isMinor: false, isVerifiedSeller: true,
    bkashNumber: '01711111111', nagadNumber: '01722222222',
    createdAt: now, __smokeTest: true,
  });
  await db.collection('auctions').doc(auctionId).set({
    id: auctionId, sellerId, title: '__E2E TEST AUCTION — auto-deleted__',
    description: 'Automated end-to-end test listing. Safe to ignore; auto-deleted by CI teardown.',
    status: 'ACTIVE', category: 'other', condition: 'USED',
    images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32'],
    location: 'mirpur', startingPrice: 100, currentPrice: 100, currentBidderId: null,
    minBidIncrement: 10, bidCount: 0, proxyMaxBid: 0, proxyBidderId: null,
    secondHighestBidderId: null, secondHighestBidAmount: 0, wasExtended: false,
    reservePrice: null, buyItNowPrice: null, deliveryCharge: 0, watchlist: [],
    isFeatured: false, winnerId: null, viewCount: 0, commissionEarned: 0, commissionRate: 0,
    startTime: new Date(now.getTime() - 60_000), endTime: new Date(now.getTime() + 2 * 3600_000),
    createdAt: now, updatedAt: now, __smokeTest: true,
  });

  fs.writeFileSync(
    path.resolve(process.cwd(), 'tests/e2e/.seed.json'),
    JSON.stringify({ bidderEmail, password, auctionId }, null, 2),
  );
  console.log(`[e2e setup] seeded bidder=${bidderEmail} auction=${auctionId}`);
}
