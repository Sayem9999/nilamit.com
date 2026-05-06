/**
 * POST /api/cron/process-auctions
 *
 * Backwards-compatibility alias for /api/cron/close-auctions. Both endpoints
 * MUST NOT be scheduled simultaneously — they share the same underlying
 * `closeAllEndedAuctions` function and would race on the same expiring
 * auctions. Prefer scheduling /api/cron/close-auctions.
 *
 * Next.js' route-segment-config validator rejects re-exports of `dynamic`,
 * so we declare it locally and only forward the POST handler.
 */

export const dynamic = 'force-dynamic';

export { POST } from '../close-auctions/route';
