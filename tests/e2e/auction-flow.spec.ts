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

    // 4. Go to Create Auction Page
    await page.goto('/auctions/create');
    await expect(page).toHaveURL(/.*auctions\/create/);

    // 5. Fill Auction Form
    await page.fill('input[name="title"]', 'E2E Test: Vintage Camera');
    await page.fill('textarea[name="description"]', 'A beautifully maintained vintage camera for collectors.');
    await page.selectOption('select[name="category"]', 'electronics');
    await page.fill('input[name="startingPrice"]', '5000');
    await page.fill('input[name="minBidIncrement"]', '100');
    
    // Set end time to 2 days from now
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await page.fill('input[name="endTime"]', twoDaysFromNow);

    // 6. Submit
    await page.click('button:has-text("Create Auction")');

    // 7. Verify Redirect to Detail Page
    await expect(page).toHaveURL(/\/auctions\/[a-zA-Z0-9]+/);
    await expect(page.locator('h1')).toContainText('Vintage Camera');
    
    // 8. Verify Success Alert
    await expect(page.locator('text=Successfully created')).toBeVisible();
  });
});
