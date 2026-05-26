# Nilamit — Automated Visual Regression Testing (VRT) Guide

This guide outlines the technical implementation, architectural decisions, and testing workflows for **Visual Regression Testing (VRT)** on the Nilamit platform. VRT ensures that layout adjustments, typography wrapping, and responsive sizing tokens do not introduce rendering bugs, text clippings, or component overlaps across mobile and desktop viewports.

---

## 1. Why Visual Regression Testing (VRT)?

Traditional unit and integration tests excel at verifying business logic and API contracts, but are blind to visual flaws:
* **Hidden CSS Failures**: A change in `flex-row` rules can squeeze text into 1-character columns on smaller viewports.
* **Component Collisions**: Absolute positioning or missing margins can cause avatars to overlap usernames.
* **Alt-Text Overflows**: Broken images displaying verbose alternative text can shift adjacent buttons out of alignment.
* **Unintentional Spacing Shift**: Modifications to base styling grids can corrupt card padding across nested layouts.

By checking the visual output pixel-by-pixel, VRT guarantees UI consistency and flags visual regressions before they ever impact live production.

---

## 2. Technical Stack

Nilamit uses **Playwright Test** for End-to-End (E2E) testing and visual validation:
* **Core**: `@playwright/test` for orchestrating browsers, viewports, and page states.
* **Assertion Engine**: Built-in screenshot matcher (`toHaveScreenshot()`) backed by `pixelmatch`.
* **Cross-Browser Verification**: Simulates Chromium, Firefox, and WebKit (Safari).
* **Responsive Emulation**: Emulates mobile sizes (e.g., iPhone 12, Pixel 5) and desktop grids.

---

## 3. Configuration Setup (`playwright.config.ts`)

To ensure visual tests produce consistent snapshots across different operating systems and container environments, optimize `playwright.config.ts` with these specific visual options:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // 📸 Set standardized screenshot options for pixel validation
    screenshot: 'only-on-failure',
  },

  // 📸 Snapshot matching settings
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 20, // Strict pixel difference tolerance (0.01% of standard viewport)
      threshold: 0.1,    // High sensitivity to subtle color changes (0 is identical)
      animations: 'disabled', // Disables CSS transitions, spins, and web animations
    },
  },

  projects: [
    /* 💻 Standard Desktop Layouts */
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    /* 📱 Mobile Portrait Layouts (Highly Critical for Nilamit C2C Mobile Experience) */
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

---

## 4. Visual Test Specification (VRT Spec Example)

Create E2E visual regression tests under `tests/e2e/visual/`. Below is a robust spec targeting the newly optimized **Coordination and Escrow** layout:

```typescript
// tests/e2e/visual/coordination.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Coordination details and Escrow Action Card Visual Regression', () => {
  
  // Set up auth session cookies before runs
  test.beforeEach(async ({ page }) => {
    // Inject mock session cookie for authenticated views
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'mock-session-token-coordination',
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        secure: false,
      }
    ]);
  });

  test('Verify coordination detail page layout on desktop', async ({ page }) => {
    // Navigate directly to the live coordination page
    await page.goto('/dashboard/coordination/test-conversation-id');

    // Wait for the hydration and animation effects to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Allow any layout transitions to settle

    // 📸 Assert that the full page matches the pixel baseline exactly
    await expect(page).toHaveScreenshot('coordination-page-desktop.png', {
      fullPage: true,
      mask: [
        page.locator('.font-mono'), // Mask timestamps and dynamic transaction IDs to avoid false failures
      ]
    });
  });

  test('Verify EscrowActionCard vertical-stacked sidebar layout', async ({ page }) => {
    await page.goto('/dashboard/coordination/test-conversation-id');
    await page.waitForLoadState('networkidle');

    // Select the Escrow Action Card specifically
    const escrowCard = page.locator('div.border-border.bg-card');
    await escrowCard.scrollIntoViewIfNeeded();

    // 📸 Capture component-level snapshot (specifically checking stacked badge and progress line states)
    await expect(escrowCard).toHaveScreenshot('escrow-action-card-vertical.png', {
      threshold: 0.05, // Ultra-sensitive mode for key actionable layout items
    });
  });

  test('Verify coordination chat interface rendering (No overlapping alt-text username)', async ({ page }) => {
    await page.goto('/dashboard/coordination/test-conversation-id');
    await page.waitForLoadState('networkidle');

    const chatHeader = page.locator('div.border-b.border-gray-50');

    // 📸 Confirm the avatar container doesn't overflow text when images are missing/broken
    await expect(chatHeader).toHaveScreenshot('chat-header-avatar-fallback.png');
  });
});
```

---

## 5. Visual Regression Workflow

### Step A: Initialize/Generate Baseline Snapshots
When launching new pages or components, generate the initial baseline screenshots:
```bash
npx playwright test --update-snapshots
```
This commands runs the suite and writes standard `.png` images into a dedicated `tests/e2e/visual/__snapshots__/` directory. Commit these baseline files to Git.

### Step B: Validate Visual Diffs during Development
To verify that changes have not caused alignment regressions:
```bash
npx playwright test
```
If Playwright detects a visual mismatch:
* The test fails.
* It generates three images in `test-results/`:
  1. `actual.png` - What the screen looks like with your changes.
  2. `expected.png` - The original baseline screenshot.
  3. `diff.png` - A high-contrast image overlay highlighting changed pixels in **bright pink**.

### Step C: Update Baselines for Intentional Design Upgrades
If you intentionally modify a design token, upgrade components, or change margins, overwrite the old baseline:
```bash
npx playwright test --update-snapshots
```
Review the newly updated snapshots in Git to confirm the baseline change reflects your intended design upgrades.

---

## 6. Continuous Integration (GitHub Actions)

Add VRT to your CI pipeline (`.github/workflows/e2e.yml`) to automatically check pull requests:

```yaml
name: Playwright Visual Regression tests

on:
  pull_request:
    branches: [ main ]

jobs:
  visual-test:
    timeout-minutes: 20
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright Browsers
      run: npx playwright install --with-deps

    - name: Build local server
      run: npm run build

    - name: Run Playwright E2E & VRT
      run: npx playwright test
      env:
        # Prevent mock failures
        NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
        FIRESTORE_EMULATOR_HOST: "localhost:8080"

    - name: Archive Visual Test Failure HTML Report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```
