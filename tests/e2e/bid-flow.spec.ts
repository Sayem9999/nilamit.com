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

async function verifyUserByEmail(email: string) {
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
    throw new Error(`User with email ${email} was not found in Firestore after 7.5 seconds retry loop.`);
  }

  await snap.docs[0].ref.update({
    isVerifiedSeller: true,
    isPhoneVerified: true,
    emailVerified: new Date(),
    bkashNumber: '01711111111',
    nagadNumber: '01722222222',
    address: 'Dhaka, Bangladesh',
  });
}

async function endAuctionAndAwardWinner(auctionId: string, bidderEmail: string) {
  const db = getFirestore();
  
  // Get bidder user
  const bidderSnap = await db.collection('users').where('email', '==', bidderEmail).limit(1).get();
  if (bidderSnap.empty) throw new Error('Bidder user not found');
  const bidderId = bidderSnap.docs[0].id;

  // Get auction document
  const auctionRef = db.collection('auctions').doc(auctionId);
  const auctionSnap = await auctionRef.get();
  if (!auctionSnap.exists) throw new Error('Auction not found');
  const auctionData = auctionSnap.data()!;

  const now = new Date();
  
  // Update auction to SOLD
  await auctionRef.update({
    status: 'SOLD',
    winnerId: bidderId,
    currentPrice: 51000,
    currentBidderId: bidderId,
    updatedAt: now,
  });

  // Create escrowTransactions record
  const escrowRef = db.collection('escrowTransactions').doc(auctionId);
  await escrowRef.set({
    id: auctionId,
    auctionId: auctionId,
    buyerId: bidderId,
    sellerId: auctionData.sellerId,
    amount: 51000 + (auctionData.deliveryCharge ?? 0),
    status: 'PENDING',
    paymentMethod: null,
    providerRef: null,
    verificationType: null,
    createdAt: now,
    updatedAt: now,
  });
}

test.describe('End-to-End Bid Flow Happy Path', () => {
  const uniqueId = Date.now();
  const sellerEmail = `seller_${uniqueId}@nilamit.test`;
  const bidderEmail = `bidder_${uniqueId}@nilamit.test`;
  const auctionTitle = `E2E Auction - Vintage Rolex ${uniqueId}`;

  test('complete cycle: register, list, bid, win, confirm escrow', async ({ page }) => {
    test.setTimeout(120000);
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err.message));
    // 1. REGISTER THE SELLER
    await page.goto('/register');
    
    // Step 1: Account Type
    await page.click('text=Personal Account');
    
    // Step 2: Switch to Email signup to bypass real SMS OTP (directly on email form now)

    // Step 3: Fill form using correct IDs
    await page.fill('#email-signup-name', 'Nilamit Seller');
    await page.fill('#email-signup-email', sellerEmail);
    await page.fill('#email-signup-password', 'SellerPass123!');
    await page.fill('#email-signup-confirm', 'SellerPass123!');
    await page.click('button[type="submit"]');

    // Wait for the success screen with a 30s timeout to allow for lazy compilation and password hashing
    await expect(page.locator('h2')).toContainText(/Welcome|Successful/i, { timeout: 30000 });
    await verifyUserByEmail(sellerEmail);
    await page.click('a[href="/login"]');
    
    // Fill login
    await page.fill('input[type="email"]', sellerEmail);
    await page.fill('input[type="password"]', 'SellerPass123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard/profile or homepage with 30s timeout
    await expect(page).toHaveURL(/.*dashboard|.*profile|\/$/, { timeout: 30000 });

    // 2. Setup mock file upload router interceptor
    await page.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32' }),
      });
    });

    // LIST AN AUCTION (AS SELLER) (Multi-step wizard)
    await page.goto('/auctions/create');
    await expect(page).toHaveURL(/.*auctions\/create/);

    // Step 1: Details
    await page.fill('input[name="title"]', auctionTitle);
    await page.fill('textarea[name="description"]', 'Exquisite gold watch in pristine condition.');
    await page.selectOption('select[name="category"]', 'fashion');
    // Upload mock image (using a valid 1x1 transparent PNG buffer so client-side canvas compression doesn't crash)
    const validPngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636460606000000002000127af20480000000049454e44ae426082', 'hex');
    await page.setInputFiles('input[type="file"]', {
      name: 'vintage-rolex.png',
      mimeType: 'image/png',
      buffer: validPngBuffer,
    });
    
    // Wait for the uploaded image wrapper to display to ensure form.images is populated
    await expect(page.locator('img[alt="Image"]').first()).toBeVisible();

    await page.click('button:has-text("Next Step")');

    // Step 2: Pricing
    await page.fill('input[name="startingPrice"]', '50000');
    await page.fill('input[name="minBidIncrement"]', '1000');
    await page.click('button:has-text("Next Step")');
    
    // Step 3: Schedule
    const nowISO = new Date().toISOString().slice(0, 16);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.fill('input[name="startTime"]', nowISO);
    await page.fill('input[name="endTime"]', twoDaysFromNow);
    await page.click('button:has-text("Next Step")');

    // Step 4: Review and Submit
    await page.click('button:has-text("Publish Auction")');

    // Wait for redirect to auction details page (excluding 'create') and extract ID
    // Add 30 seconds timeout to allow for Next.js dev server compilation of the server actions
    await expect(page).toHaveURL(/\/auctions\/(?!create)[a-zA-Z0-9]+/, { timeout: 30000 });
    const auctionUrl = page.url();
    const auctionId = auctionUrl.split('/').pop() || '';
    expect(auctionId).not.toBe('');

    // Logout seller to switch users by clicking profile dropdown and then Sign Out
    await page.click('button:has-text("Profile")');
    await page.click('button:has-text("Sign Out")');
    await page.waitForURL(/.*login.*/);

    // 3. REGISTER THE BIDDER
    await page.goto('/register');
    
    // Step 1: Account Type
    await page.click('text=Personal Account');
    
    // Step 2: Switch to Email signup (directly on email form now)

    // Step 3: Fill form using correct IDs
    await page.fill('#email-signup-name', 'Nilamit Bidder');
    await page.fill('#email-signup-email', bidderEmail);
    await page.fill('#email-signup-password', 'BidderPass123!');
    await page.fill('#email-signup-confirm', 'BidderPass123!');
    await page.click('button[type="submit"]');
    
    // Wait for the success screen with a 30s timeout to allow for lazy compilation and password hashing
    await expect(page.locator('h2')).toContainText(/Welcome|Successful/i, { timeout: 30000 });
    await verifyUserByEmail(bidderEmail);
    await page.click('a[href="/login"]');
    
    // Fill login
    await page.fill('input[type="email"]', bidderEmail);
    await page.fill('input[type="password"]', 'BidderPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard|.*profile|\/$/, { timeout: 30000 });

    // 4. PLACE A BID (AS BIDDER)
    await page.goto(`/auctions/${auctionId}`, { timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Vintage Rolex');

    // Input the bid amount (starting price is 50000, first bid should be 51000+)
    await page.fill('#bid-amount-input', '51000');
    await page.click('button:has-text("Confirm Bid of")');

    // Expect successful bid notification
    await expect(page.locator('p:has-text("Bid placed successfully")')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('text=৳51,000').first()).toBeVisible({ timeout: 25000 });

    // 5. SIMULATE AUCTION END (WINNER DETERMINATION)
    await endAuctionAndAwardWinner(auctionId, bidderEmail);

    // Go to Won / Advance Payment tab on dashboard
    await page.goto('/dashboard?tab=escrow', { timeout: 30000 });
    await expect(page.locator('text=Won / Advance Payment')).toBeVisible();

    // Wait for hydration to complete to ensure event listeners are attached
    await page.waitForTimeout(2000);

    // Click pay advance link
    await page.click('button:has-text("Pay Advance Fee")');

    // Interact with the manual MFS payment modal: enter phone + real TrxID, consent, submit
    await page.fill('input[type="tel"]', '01711111111');
    await page.fill('input[placeholder="e.g. 9H7A2K4L8P"]', 'TRX12345678');
    await page.check('#policy-consent');
    await page.click('button:has-text("Submit for verification")');

    // Action success transitions escrow status to VERIFICATION_PENDING
    await expect(page.locator('text=Verification in Progress')).toBeVisible({ timeout: 35000 });
  });
});
