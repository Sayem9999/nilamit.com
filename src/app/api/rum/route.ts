/**
 * POST /api/rum
 *
 * Real-user-monitoring ingestion. Browser sends Web Vitals (LCP, CLS, INP,
 * FCP, TTFB) on page hide; we ship each to BigQuery via the existing
 * log.event() pipeline. Aggregation happens downstream (Looker Studio
 * scheduled queries against nilamit_events.events).
 *
 * No auth — RUM is per-page-load, not per-user. We do rate-limit by IP
 * to prevent BigQuery cost abuse from a stuck client retrying.
 *
 * Don't use sendBeacon's auto-retry behavior for analytics — duplicates
 * are fine here (the report has its own UUID id) and beacon is best-effort.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLimiter } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const InputSchema = z.object({
  name: z.enum(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']),
  value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  /** Page path the vital was measured on. */
  path: z.string().max(500),
  /** Unique browser-session id so a session's vitals can be correlated. */
  sessionId: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  // Anonymous endpoint — limit by IP, not user. Soft cap; we don't want
  // RUM dropouts to confuse percentile math.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anon';
  const rl = await apiLimiter.limit(`rum:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ ok: true }, { status: 200 }); // silently drop
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  log.event('web_vital' as never, {
    metadata: {
      name: parsed.data.name,
      value: parsed.data.value,
      rating: parsed.data.rating,
      path: parsed.data.path,
      sessionId: parsed.data.sessionId,
    },
  });

  return NextResponse.json({ ok: true });
}
