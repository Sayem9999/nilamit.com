import { test, expect } from '@playwright/test';

/**
 * E2E Test: Critical Path - Auction Creation
 * This test verifies that a verified seller can log in and list an item for auction.
 */

test.describe('Auction Lifecycle', () => {
  test('should allow a verified user to create a new auction', async ({ page }) => {
    // 1. Visit Homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/nilamit/i);

    // 2. Navigate to Login (assuming link in header)
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/.*login/);

    // 3. Perform Mock Login (using test credentials)
    await page.fill('input[name="email"]', 'seller@nilamit.test');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard/profile to ensure session is fully established
    await expect(page).toHaveURL(/.*dashboard|.*profile/);

    // 4. Setup mock file upload router interceptor
    await page.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32' }),
      });
    });

    // Go to Create Auction Page
    await page.goto('/auctions/create');
    await expect(page).toHaveURL(/.*auctions\/create/);

    // 5. Fill Auction Form (Multi-step wizard)
    // Step 1: Details
    await page.fill('input[name="title"]', 'E2E Test: Vintage Camera');
    await page.fill('textarea[name="description"]', 'A beautifully maintained vintage camera for collectors.');
    await page.selectOption('select[name="category"]', 'electronics');
    
    // Upload mock image (using a valid 1x1 transparent PNG buffer so client-side canvas compression doesn't crash)
    const validPngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636460606000000002000127af20480000000049454e44ae426082', 'hex');
    await page.setInputFiles('input[type="file"]', {
      name: 'vintage-camera.png',
      mimeType: 'image/png',
      buffer: validPngBuffer,
    });
    
    // Wait for the uploaded image wrapper to display to ensure form.images is populated
    await expect(page.locator('img[alt="Image"]').first()).toBeVisible();
    
    await page.click('button:has-text("Next Step")');

    // Step 2: Pricing
    await page.fill('input[name="startingPrice"]', '5000');
    await page.fill('input[name="minBidIncrement"]', '100');
    await page.click('button:has-text("Next Step")');
    
    // Step 3: Schedule
    const nowISO = new Date().toISOString().slice(0, 16);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.fill('input[name="startTime"]', nowISO);
    await page.fill('input[name="endTime"]', twoDaysFromNow);
    await page.click('button:has-text("Next Step")');

    // Step 4: Review and Submit
    await page.click('button:has-text("Publish Auction")');

    // 7. Verify Redirect to Detail Page (excluding 'create' using negative lookahead)
    // Add 30 seconds timeout to allow for Next.js dev server compilation of the server actions
    await expect(page).toHaveURL(/\/auctions\/(?!create)[a-zA-Z0-9]+/, { timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Vintage Camera', { timeout: 15000 });
    
    // 8. Verify details page content is visible
    await expect(page.locator('text=Track Auction')).toBeVisible();
  });
});
