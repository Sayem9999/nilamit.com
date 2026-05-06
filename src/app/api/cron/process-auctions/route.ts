/**
 * POST /api/cron/process-auctions
 *
 * Backwards-compatibility alias for /api/cron/close-auctions. Both endpoints
 * MUST NOT be scheduled simultaneously — they share the same underlying
 * `closeAllEndedAuctions` function and would race on the same expiring
 * auctions. Prefer scheduling /api/cron/close-auctions.
 *
 * This file re-exports the close-auctions handler so removing one of the
 * two from Cloud Scheduler is the only operational change required to
 * eliminate the duplicate.
 */

export { POST, dynamic } from '../close-auctions/route';
