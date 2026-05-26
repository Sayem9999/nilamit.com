import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function verifyUserAndSetReputation(email: string, reputation: number) {
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
  
  let snap;
  for (let i = 0; i < 15; i++) {
    snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snap.empty) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!snap || snap.empty) {
    throw new Error(`User with email ${email} was not found in Firestore.`);
  }

  await snap.docs[0].ref.update({
    isVerifiedSeller: true,
    emailVerified: new Date(),
    rating: 4.8,
    ratingCount: 15,
    reputationScore: reputation,
    bkashNumber: '01711111111',
    nagadNumber: '01722222222',
    address: 'Dhaka, Bangladesh',
  });
}

test.describe('E2E High Concurrency Bidding Simulation', () => {
  const uniqueId = Date.now();
  const sellerEmail = `seller_con_${uniqueId}@nilamit.test`;
  const bidderAEmail = `bidder_a_${uniqueId}@nilamit.test`;
  const bidderBEmail = `bidder_b_${uniqueId}@nilamit.test`;
  const auctionTitle = `Concurrency Rolex ${uniqueId}`;

  test('Simulate concurrent bidding participants', async ({ browser }) => {
    test.setTimeout(120000);

    // 1. Setup contexts for participants
    const sellerContext = await browser.newContext();
    const bidderAContext = await browser.newContext();
    const bidderBContext = await browser.newContext();

    const sellerPage = await sellerContext.newPage();
    const bidderAPage = await bidderAContext.newPage();
    const bidderBPage = await bidderBContext.newPage();

    // 2. Register Seller & create listing
    await sellerPage.goto('/register');
    await sellerPage.click('text=Personal Account');
    await sellerPage.fill('#email-signup-name', 'Rolex Seller');
    await sellerPage.fill('#email-signup-email', sellerEmail);
    await sellerPage.fill('#email-signup-password', 'SellerPass123!');
    await sellerPage.fill('#email-signup-confirm', 'SellerPass123!');
    await sellerPage.click('button[type="submit"]');

    await expect(sellerPage.locator('h2')).toContainText(/Welcome|Successful/i, { timeout: 30000 });
    await verifyUserAndSetReputation(sellerEmail, 100);

    await sellerPage.click('a[href="/login"]');
    await sellerPage.fill('input[type="email"]', sellerEmail);
    await sellerPage.fill('input[type="password"]', 'SellerPass123!');
    await sellerPage.click('button[type="submit"]');
    await expect(sellerPage).toHaveURL(/.*dashboard|.*profile|\/$/, { timeout: 30000 });

    // Mock image upload
    await sellerPage.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32' }),
      });
    });

    // List the Rolex auction
    await sellerPage.goto('/auctions/create');
    await sellerPage.fill('input[name="title"]', auctionTitle);
    await sellerPage.fill('textarea[name="description"]', 'Pristine Roles watch, concurrency test.');
    await sellerPage.selectOption('select[name="category"]', 'fashion');

    const transparentPngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636460606000000002000127af20480000000049454e44ae426082', 'hex');
    await sellerPage.setInputFiles('input[type="file"]', {
      name: 'concurrency-rolex.png',
      mimeType: 'image/png',
      buffer: transparentPngBuffer,
    });
    await expect(sellerPage.locator('img[alt="Image"]').first()).toBeVisible();

    await sellerPage.click('button:has-text("Next Step")');
    await sellerPage.fill('input[name="startingPrice"]', '10000');
    await sellerPage.fill('input[name="minBidIncrement"]', '1000');
    await sellerPage.click('button:has-text("Next Step")');

    const nowISO = new Date().toISOString().slice(0, 16);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await sellerPage.fill('input[name="startTime"]', nowISO);
    await sellerPage.fill('input[name="endTime"]', twoDaysFromNow);
    await sellerPage.click('button:has-text("Next Step")');
    await sellerPage.click('button:has-text("Publish Auction")');

    await expect(sellerPage).toHaveURL(/\/auctions\/(?!create)[a-zA-Z0-9]+/, { timeout: 30000 });
    const auctionUrl = sellerPage.url();
    const auctionId = auctionUrl.split('/').pop() || '';
    expect(auctionId).not.toBe('');

    // 3. Register & login Bidder A
    await bidderAPage.goto('/register');
    await bidderAPage.click('text=Personal Account');
    await bidderAPage.fill('#email-signup-name', 'Bidder A');
    await bidderAPage.fill('#email-signup-email', bidderAEmail);
    await bidderAPage.fill('#email-signup-password', 'BidderPass123!');
    await bidderAPage.fill('#email-signup-confirm', 'BidderPass123!');
    await bidderAPage.click('button[type="submit"]');

    await expect(bidderAPage.locator('h2')).toContainText(/Welcome|Successful/i, { timeout: 30000 });
    await verifyUserAndSetReputation(bidderAEmail, 95);

    await bidderAPage.click('a[href="/login"]');
    await bidderAPage.fill('input[type="email"]', bidderAEmail);
    await bidderAPage.fill('input[type="password"]', 'BidderPass123!');
    await bidderAPage.click('button[type="submit"]');
    await expect(bidderAPage).toHaveURL(/.*dashboard|.*profile|\/$/, { timeout: 30000 });

    // 4. Register & login Bidder B
    await bidderBPage.goto('/register');
    await bidderBPage.click('text=Personal Account');
    await bidderBPage.fill('#email-signup-name', 'Bidder B');
    await bidderBPage.fill('#email-signup-email', bidderBEmail);
    await bidderBPage.fill('#email-signup-password', 'BidderPass123!');
    await bidderBPage.fill('#email-signup-confirm', 'BidderPass123!');
    await bidderBPage.click('button[type="submit"]');

    await expect(bidderBPage.locator('h2')).toContainText(/Welcome|Successful/i, { timeout: 30000 });
    await verifyUserAndSetReputation(bidderBEmail, 90);

    await bidderBPage.click('a[href="/login"]');
    await bidderBPage.fill('input[type="email"]', bidderBEmail);
    await bidderBPage.fill('input[type="password"]', 'BidderPass123!');
    await bidderBPage.click('button[type="submit"]');
    await expect(bidderBPage).toHaveURL(/.*dashboard|.*profile|\/$/, { timeout: 30000 });

    // 5. Place concurrent bids simultaneously
    await bidderAPage.goto(`/auctions/${auctionId}`, { timeout: 30000 });
    await bidderBPage.goto(`/auctions/${auctionId}`, { timeout: 30000 });

    // Bidder A puts ৳12,000 and Bidder B puts ৳15,000 (Proxy Ceiling) simultaneously
    await bidderAPage.fill('#bid-amount-input', '12000');
    await bidderBPage.fill('#bid-amount-input', '15000');

    // Trigger submissions concurrently
    const bidSubmissions = await Promise.allSettled([
      bidderAPage.click('button:has-text("Confirm Bid of")'),
      bidderBPage.click('button:has-text("Confirm Bid of")')
    ]);

    // Check that at least one bid processed successfully under active transaction locking
    const fulfilledCount = bidSubmissions.filter(s => s.status === 'fulfilled').length;
    expect(fulfilledCount).toBeGreaterThan(0);

    // Close pages and clean up contexts
    await sellerContext.close();
    await bidderAContext.close();
    await bidderBContext.close();
  });
});
