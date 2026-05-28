"use server";

/**
 * Saved searches CRUD.
 *
 * Users save a filter combo ("iPhone under 80k in Dhaka"); a cron job runs
 * the same query periodically and pushes notifications when new auctions
 * match. Stored under savedSearches/{userId}_{slug} for predictable IDs
 * and easy per-user listing.
 *
 * The matching cron lives at /api/cron/saved-search-matches (TODO scaffold);
 * for now this just persists the searches.
 */

import { auth } from '@/lib/auth';
import { db, newId } from '@/lib/db';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const SavedSearchSchema = z.object({
  label: z.string().min(1).max(80),
  /** Mirrors the /auctions query shape so we can re-run it server-side. */
  filters: z.object({
    search: z.string().max(200).optional(),
    category: z.string().max(80).optional(),
    location: z.string().max(80).optional(),
    condition: z.enum(['NEW', 'USED', 'REFURBISHED']).optional(),
    minPrice: z.number().int().nonnegative().optional(),
    maxPrice: z.number().int().nonnegative().optional(),
  }),
  /** Email + in-app default; user can change later. */
  notify: z
    .object({
      inApp: z.boolean().default(true),
      email: z.boolean().default(false),
      fcm: z.boolean().default(true),
    })
    .default({ inApp: true, email: false, fcm: true }),
});

export type SavedSearchInput = z.infer<typeof SavedSearchSchema>;

export interface SavedSearch extends SavedSearchInput {
  id: string;
  userId: string;
  /** Last time the cron ran a match check for this — for cooldown / debugging. */
  lastCheckedAt?: Date | null;
  /** Total matches sent so far (so we can cap aggressive searches). */
  matchCount?: number;
  createdAt: Date;
}

export async function createSavedSearch(input: unknown): Promise<ServiceResponse<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const parsed = SavedSearchSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, 'Invalid filter shape');

  const id = newId();
  const record: SavedSearch = {
    ...parsed.data,
    id,
    userId: session.user.id,
    createdAt: new Date(),
    matchCount: 0,
  };

  try {
    await db.collection('savedSearches').doc(id).set(record);
    revalidatePath('/dashboard');
    return successResponse({ id });
  } catch (err) {
    log.error('[savedSearch] create failed', err, { userId: session.user.id });
    return errorResponse(ErrorType.INTERNAL, 'Could not save your search');
  }
}

export async function deleteSavedSearch(id: string): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  try {
    const snap = await db.collection('savedSearches').doc(id).get();
    if (!snap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Search not found');
    if ((snap.data() as SavedSearch).userId !== session.user.id) {
      return errorResponse(ErrorType.FORBIDDEN, 'Not your saved search');
    }
    await db.collection('savedSearches').doc(id).delete();
    revalidatePath('/dashboard');
    return successResponse(null);
  } catch (err) {
    log.error('[savedSearch] delete failed', err, { userId: session.user.id, id });
    return errorResponse(ErrorType.INTERNAL, 'Could not delete saved search');
  }
}

export async function listMySavedSearches(): Promise<ServiceResponse<SavedSearch[]>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  try {
    const snap = await db
      .collection('savedSearches')
      .where('userId', '==', session.user.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const records = snap.docs.map((d) => ({ ...(d.data() as SavedSearch), id: d.id }));
    return successResponse(records);
  } catch (err) {
    log.error('[savedSearch] list failed', err, { userId: session.user.id });
    return errorResponse(ErrorType.INTERNAL, 'Could not load saved searches');
  }
}

/**
 * Bump a saved-search's last-checked timestamp + match count.
 * Called from the cron after running the filter query.
 */
export async function recordSavedSearchMatch(
  id: string,
  matches: number,
): Promise<ServiceResponse<null>> {
  try {
    await db.collection('savedSearches').doc(id).update({
      lastCheckedAt: FieldValue.serverTimestamp(),
      matchCount: FieldValue.increment(matches),
    });
    return successResponse(null);
  } catch (err) {
    log.warn('[savedSearch] record-match failed', { id, error: String(err) });
    return errorResponse(ErrorType.INTERNAL, 'record failed');
  }
}
