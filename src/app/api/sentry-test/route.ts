/**
 * Sentry alert verification endpoint.
 *
 * Hitting this endpoint deliberately throws — used to confirm the alert
 * pipeline (DSN → Sentry project → alert rule → Slack/email) is wired
 * end-to-end. See `docs/SENTRY_ALERTS.md`.
 *
 * Admin-gated so a passer-by can't spam our Sentry quota or trip alert rules
 * for fun.
 *
 * Usage:
 *   GET /api/sentry-test            → throws, tagged area:test severity:info
 *   GET /api/sentry-test?area=bid   → throws, tagged area:bid severity:critical
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireAdmin } from '@/lib/admin-guard';
import type { SentryArea, SentrySeverity } from '@/lib/sentry-tags';

export const dynamic = 'force-dynamic';

const ALLOWED_AREAS: SentryArea[] = [
  'bid', 'escrow', 'auth', 'cron', 'upload', 'admin', 'chat', 'dispute', 'logistics', 'test',
];

const ALLOWED_SEVERITIES: SentrySeverity[] = ['critical', 'warning', 'info'];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const areaParam = url.searchParams.get('area') ?? 'test';
  const severityParam = url.searchParams.get('severity') ?? 'info';

  const area = (ALLOWED_AREAS as string[]).includes(areaParam) ? (areaParam as SentryArea) : 'test';
  const severity = (ALLOWED_SEVERITIES as string[]).includes(severityParam)
    ? (severityParam as SentrySeverity)
    : 'info';

  const error = new Error(`Sentry alert verification — area=${area} severity=${severity}`);

  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    scope.setTag('severity', severity);
    scope.setTag('component', 'sentry-test');
    Sentry.captureException(error);
  });

  return NextResponse.json({
    captured: true,
    area,
    severity,
    note: 'Event sent. Check Sentry within ~30s and confirm the matching alert fires.',
  });
}
