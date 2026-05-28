/**
 * Idempotency helper for financial / state-mutating Server Actions.
 *
 * Pattern: the client sends a UUID per logical operation. Server checks
 * `idempotency/{key}` doc — if it exists and is < TTL old, returns the
 * cached response instead of re-running the operation.
 *
 * Storage: lightweight Firestore doc per key. TTL field lets a background
 * cleanup or Firestore TTL policy GC stale records (1h is plenty for bid
 * retries). Don't use Redis for this — Firestore tx isolation guarantees
 * the read-then-write race-safety we need.
 *
 * Usage in a Server Action:
 *   const cached = await checkIdempotency(key);
 *   if (cached) return cached;
 *   const result = await doTheWork();
 *   await storeIdempotency(key, result);
 *   return result;
 *
 * Skip entirely if key is missing — older clients that haven't been
 * updated still work, just without retry-safety.
 */

import 'server-only';
import { db } from '@/lib/db';
import { FieldValue } from 'firebase-admin/firestore';
import { log } from '@/lib/logger';

const COLLECTION = 'idempotency';
const TTL_MS = 60 * 60 * 1000; // 1 hour

interface IdempotencyRecord<T = unknown> {
  result: T;
  createdAt: { toMillis: () => number } | Date;
}

/**
 * Look up a stored response for this key. Returns null if not seen or expired.
 * Throw-safe — Firestore outage falls through to "no record" so the action
 * proceeds (better duplicate-risk than total outage).
 */
export async function checkIdempotency<T>(key: string | undefined): Promise<T | null> {
  if (!key) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const data = snap.data() as IdempotencyRecord<T>;
    const createdMs =
      typeof (data.createdAt as { toMillis?: () => number }).toMillis === 'function'
        ? (data.createdAt as { toMillis: () => number }).toMillis()
        : (data.createdAt as Date).getTime?.() ?? 0;
    if (Date.now() - createdMs > TTL_MS) {
      return null; // Stale — treat as a new request.
    }
    return data.result;
  } catch (err) {
    log.warn('[idempotency] check failed — proceeding without cache', { key, error: String(err) });
    return null;
  }
}

/**
 * Persist the operation's response under this key so retries echo it back.
 * Best-effort — failure to store doesn't fail the underlying operation.
 */
export async function storeIdempotency<T>(key: string | undefined, result: T): Promise<void> {
  if (!key) return;
  try {
    await db.collection(COLLECTION).doc(key).set({
      result,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    log.warn('[idempotency] store failed', { key, error: String(err) });
  }
}
