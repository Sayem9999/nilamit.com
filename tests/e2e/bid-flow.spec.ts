import { test, expect } from '@playwright/test';

test.describe('End-to-End Bid Flow Happy Path', () => {
  const uniqueId = Date.now();
  const sellerEmail = `seller_${uniqueId}@nilamit.test`;
  const bidderEmail = `bidder_${uniqueId}@nilamit.test`;
  const auctionTitle = `E2E Auction - Vintage Rolex ${uniqueId}`;

  test('complete cycle: register, list, bid, win, confirm escrow', async ({ page }) => {
    // 1. REGISTER THE SELLER
    await page.goto('/register');
    
    // Step 1: Account Type
    await page.click('text=Personal Account');
    
    // Step 2: Switch to Email signup to bypass real SMS OTP
    await page.click('button:has-text("Email")');

    // Step 3: Fill form using correct IDs
    await page.fill('#email-signup-name', 'Nilamit Seller');
    await page.fill('#email-signup-email', sellerEmail);
    await page.fill('#email-signup-password', 'SellerPass123!');
    await page.fill('#email-signup-confirm', 'SellerPass123!');
    await page.click('button[type="submit"]');

    // Wait for the success screen, click to login, then login
    await expect(page.locator('h2')).toContainText(/Welcome|Successful/i);
    await page.click('a[href="/login"]');
    
    // Fill login
    await page.fill('input[type="email"]', sellerEmail);
    await page.fill('input[type="password"]', 'SellerPass123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard/profile
    await expect(page).toHaveURL(/.*dashboard|.*profile/);

    // 2. LIST AN AUCTION (AS SELLER)
    await page.goto('/auctions/create');
    await expect(page).toHaveURL(/.*auctions\/create/);

    await page.fill('input[name="title"]', auctionTitle);
    await page.fill('textarea[name="description"]', 'Exquisite gold watch in pristine condition.');
    await page.selectOption('select[name="category"]', 'fashion');
    await page.fill('input[name="startingPrice"]', '50000');
    await page.fill('input[name="minBidIncrement"]', '1000');
    
    // Set end time to 2 days in the future
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.fill('input[name="endTime"]', twoDaysFromNow);

    await page.click('button:has-text("Create Auction")');

    // Wait for redirect to auction details page and extract ID
    await expect(page).toHaveURL(/\/auctions\/[a-zA-Z0-9]+/);
    const auctionUrl = page.url();
    const auctionId = auctionUrl.split('/').pop() || '';
    expect(auctionId).not.toBe('');

    // Logout seller to switch users
    await page.click('text=Logout');
    await page.waitForURL('/');

    // 3. REGISTER THE BIDDER
    await page.goto('/register');
    
    // Step 1: Account Type
    await page.click('text=Personal Account');
    
    // Step 2: Switch to Email signup
    await page.click('button:has-text("Email")');

    // Step 3: Fill form using correct IDs
    await page.fill('#email-signup-name', 'Nilamit Bidder');
    await page.fill('#email-signup-email', bidderEmail);
    await page.fill('#email-signup-password', 'BidderPass123!');
    await page.fill('#email-signup-confirm', 'BidderPass123!');
    await page.click('button[type="submit"]');
    
    // Wait for the success screen, click to login, then login
    await expect(page.locator('h2')).toContainText(/Welcome|Successful/i);
    await page.click('a[href="/login"]');
    
    // Fill login
    await page.fill('input[type="email"]', bidderEmail);
    await page.fill('input[type="password"]', 'BidderPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard|.*profile/);

    // 4. PLACE A BID (AS BIDDER)
    await page.goto(`/auctions/${auctionId}`);
    await expect(page.locator('h1')).toContainText('Vintage Rolex');

    // Input the bid amount (starting price is 50000, first bid should be 51000+)
    await page.fill('input[name="bidAmount"]', '51000');
    await page.click('button:has-text("Place Your Bid")');

    // Expect successful bid notification
    await expect(page.locator('text=Bid placed successfully')).toBeVisible();
    await expect(page.locator('text=৳ 51,000')).toBeVisible();

    // 5. SIMULATE AUCTION END (WINNER DETERMINATION)
    // In E2E tests, we call our own helper backend action / endpoint, or update Firestore.
    // For this flow test, we simulate navigation to the escrow payment page once won.
    // In a live browser session, we can redirect directly to dashboard to see winning auction.
    await page.goto('/dashboard');
    await expect(page.locator('text=Winning')).toBeVisible();
    
    // Click pay escrow link
    await page.click('text=Pay Escrow Advance');
    await expect(page).toHaveURL(/.*payments\/callback|.*escrow/);

    // Confirm Escrow Receipt (Mock Callback or action success)
    await expect(page.locator('text=Escrow payment confirmed')).toBeVisible();
  });
});
