# 🚨 CRITICAL FIXES — Priority Implementation Order

## Phase 1: DO THIS FIRST (Next 2 Weeks)

### Fix #1: next-auth Beta Version ⏱️ 2 hours
```bash
# Check current version
npm ls next-auth

# Upgrade to stable (or v4 LTS)
npm install next-auth@latest
# or
npm install next-auth@4.24.11
```

**Why:** Auth system is on beta software. Could break any time.

---

### Fix #2: Add .env.example + Startup Validation ⏱️ 3 hours

**Create `.env.example`:**
```bash
# .env.example
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=generate-with-openssl-rand-hex-32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
PUSHER_APP_ID=your-pusher-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=mt1
```

**Add to `src/lib/env.ts`:**
```typescript
const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`❌ Missing env vars: ${missing.join(', ')}\n\nCopy .env.example to .env.local and fill in values.`);
  }

  if (process.env.GOOGLE_CLIENT_ID === 'dummy') {
    throw new Error('❌ GOOGLE_CLIENT_ID is "dummy" — configure real Google OAuth');
  }
}

// Call at startup
if (typeof window === 'undefined') {
  validateEnv();
}
```

**Add to `src/app/api/health/route.ts`:**
```typescript
export async function GET() {
  try {
    validateEnv();
    await prisma.$queryRaw`SELECT 1`; // Check DB
    return Response.json({ status: 'ok' });
  } catch (error) {
    return Response.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
```

**Why:** New developers can't set up. OAuth silently fails.

---

### Fix #3: Increase Database Pool Size ⏱️ 1 hour

**Edit `src/lib/db.ts` line 31:**
```typescript
// Before
max: 10,

// After
max: 30,
```

**Why:** 500 concurrent bidders need more connections.

---

### Fix #4: Add Sentry Error Tracking ⏱️ 4 hours

```bash
npm install @sentry/nextjs
```

**Create `sentry.server.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
});
```

**Add to all critical Server Actions (`src/actions/*.ts`):**
```typescript
export async function placeBid(auctionId: string, amount: number) {
  try {
    // ... logic
  } catch (error) {
    Sentry.captureException(error, {
      tags: { action: 'placeBid' },
      contexts: { auction: { auctionId, amount } }
    });
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}
```

**Why:** Can't see errors in production = blind system.

---

### Fix #5: Add Rate Limiting ⏱️ 3 hours

```bash
npm install @upstash/ratelimit @upstash/redis
```

**Create `src/lib/ratelimit.ts`:**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const loginLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "5 m"),
  analytics: true,
});

export const bidLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
});
```

**Add to auth route:**
```typescript
import { loginLimiter } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const ip = req.ip || 'unknown';
  const { success } = await loginLimiter.limit(ip);
  
  if (!success) {
    return Response.json({ error: 'Too many login attempts' }, { status: 429 });
  }
  
  // ... auth logic
}
```

**Why:** Prevents brute force attacks.

---

### Fix #6: Cron Job Error Handling ⏱️ 4 hours

**Add to `src/app/api/cron/close-auctions/route.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

async function closeExpiredAuctions() {
  const expiringAuctions = await prisma.auction.findMany({
    where: {
      status: 'ACTIVE',
      endTime: { lte: new Date() }
    }
  });

  let successful = 0;
  const errors: { auctionId: string; error: string }[] = [];

  for (const auction of expiringAuctions) {
    try {
      await processAuctionSale(auction.id);
      successful++;
    } catch (error) {
      errors.push({
        auctionId: auction.id,
        error: error.message
      });
    }
  }

  if (errors.length > 0) {
    Sentry.captureMessage(
      `closeAuctions failed for ${errors.length}/${expiringAuctions.length} auctions`,
      'error'
    );
    
    // Store errors for manual review
    await prisma.systemLog.create({
      data: {
        type: 'CRON_FAILURE',
        job: 'closeAuctions',
        failedCount: errors.length,
        details: errors,
      }
    });
  }

  return Response.json({
    success: errors.length === 0,
    processed: expiringAuctions.length,
    successful,
    failed: errors.length
  });
}

export async function GET(req: Request) {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await closeExpiredAuctions();
      return Response.json(result);
    } catch (error) {
      lastError = error as Error;
      console.error(`[Cron Retry ${attempt}/${maxRetries}] closeAuctions failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  Sentry.captureException(lastError);
  return Response.json(
    { success: false, error: lastError?.message },
    { status: 500 }
  );
}
```

**Why:** Auctions stuck in ACTIVE state forever = money never released.

---

## Phase 2: Next Sprint (Weeks 3-4)

- [ ] Normalize images to `AuctionImage` table (database migration)
- [ ] Add Redis caching for listings/profiles
- [ ] Optimize Prisma queries with `select` projections
- [ ] Batch Pusher updates (every 2 seconds instead of per-bid)
- [ ] Standardize error responses across all Server Actions
- [ ] Add structured logging (winston)

---

## Testing Your Fixes

### Quick smoke test:
```bash
# 1. Verify env validation works
NODE_ENV=production npm run build  # Should fail if env vars missing

# 2. Test Sentry
curl http://localhost:3000/api/test-error  # Should appear in Sentry

# 3. Test rate limiting
for i in {1..15}; do curl http://localhost:3000/api/auth/signin; done
# Should get 429 on attempts 11-15

# 4. Health check
curl http://localhost:3000/api/health
# Should return { status: 'ok' }
```

---

## Deployment Checklist

Before going public:
- [ ] Run all Phase 1 fixes
- [ ] Test auth login works (Google + Phone + Email)
- [ ] Verify rate limiting is active
- [ ] Check Sentry receives errors
- [ ] Confirm cron jobs retry on failure
- [ ] Load test with 100+ concurrent bidders
- [ ] Test with 3G throttling enabled (CONSTITUTION.md requirement)

---

## Time Estimates

| Fix | Hours | Priority |
|-----|-------|----------|
| next-auth upgrade | 2 | 🔴 P0 |
| .env validation | 3 | 🔴 P0 |
| DB pool increase | 1 | 🔴 P0 |
| Sentry integration | 4 | 🔴 P0 |
| Rate limiting | 3 | 🔴 P0 |
| Cron retry logic | 4 | 🔴 P0 |
| **TOTAL PHASE 1** | **17** | |

**Can be done in 3-4 days with focused effort.**

---

Questions? See **AUDIT_REPORT.md** for full details.
