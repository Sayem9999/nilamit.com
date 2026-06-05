import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Lean, robust browser gate: log in as a seeded verified user, open a seeded
 * ACTIVE auction, place a bid, and confirm the Server Action round-trip
 * succeeds. Exercises the real login → Server Action → Firestore bid path
 * end-to-end in a browser. Seed from global-setup; teardown removes it.
 */
const seed = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.seed.json'), 'utf8'),
) as { bidderEmail: string; password: string; auctionId: string };

test('login → place bid → success', async ({ page }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));

  // 1. Log in. Target the login form's submit specifically — a bare
  //    button[type=submit] also matches the navbar search button.
  await page.goto('/login');
  await page.fill('input[type="email"]', seed.bidderEmail);
  await page.fill('input[type="password"]', seed.password);
  await page.locator('form:has(input[type="password"]) button[type="submit"]').click();

  // Confirm a real session was established for the seeded bidder.
  await expect
    .poll(async () => {
      const r = await page.request.get('/api/auth/session');
      const j = await r.json().catch(() => ({}));
      return j?.user?.email ?? null;
    }, { timeout: 30_000, message: 'waiting for authenticated session' })
    .toBe(seed.bidderEmail);

  // 2. Open the seeded auction and bid. The bid panel is a dynamic (ssr:false)
  //    client component; `fill`'s auto-wait grabs the input as soon as it's
  //    actionable, so we interact immediately rather than asserting first.
  await page.goto(`/auctions/${seed.auctionId}`);
  await page.locator('#bid-amount-input').fill('110', { timeout: 30_000 }); // startingPrice 100 + increment 10
  await page.locator('button:has-text("Confirm Bid of")').click();

  // 3. The Server Action succeeded → success toast (text also appears in an
  //    sr-only aria-live region, so take the first match).
  await expect(page.getByText(/Bid placed successfully/i).first()).toBeVisible({ timeout: 25_000 });
});
