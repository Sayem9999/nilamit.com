"use server";

/**
 * Seller KYC pipeline.
 *
 * Flow:
 *   1. Seller uploads NID front/back (+ optional trade license + selfie) via
 *      /api/upload with type='kyc'. Files land in chat/{uid}/... scope which
 *      Storage rules already restrict to uid-only read — moderators read
 *      via signed URLs minted server-side.
 *   2. Seller calls submitKyc() with the uploaded URLs. We flip status to
 *      PENDING and stamp the timestamps.
 *   3. Moderator reviews in /admin/kyc tab (TODO scaffold) and calls
 *      approveKyc() or rejectKyc() with a reason.
 *   4. APPROVED flips users/{uid}.isVerifiedSeller=true so the public badge
 *      renders. REJECTED stores the reason; seller can re-submit.
 *
 * Privacy: NID docs are PII. Storage rules forbid public reads (only the
 * uploader can read directly); moderators use server-minted signed URLs.
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminStorage } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-guard';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import type { KycStatus } from '@/types';
import { submitKycForUser } from '@/services/kyc/kyc-core';

export async function submitKyc(input: unknown): Promise<ServiceResponse<{ status: KycStatus }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  // Shared with the native bridge (/api/mobile/kyc) via submitKycForUser.
  return submitKycForUser(session.user.id, input);
}

/**
 * Admin: approve a pending KYC. Flips isVerifiedSeller=true so the public
 * badge renders. Also writes an admin_logs entry so we have an audit trail.
 */
export async function approveKyc(userId: string): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();
  const adminUserId = adminSession.user.id;
  try {
    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(userId);
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('User not found');
      const u = snap.data() as { kycStatus?: KycStatus };
      if (u.kycStatus !== 'PENDING') {
        throw new Error(`Cannot approve user in status ${u.kycStatus ?? 'NONE'}`);
      }
      tx.update(userRef, {
        kycStatus: 'APPROVED' as KycStatus,
        isVerifiedSeller: true,
        kycReviewedAt: FieldValue.serverTimestamp(),
        kycReviewedBy: adminUserId,
        kycRejectReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('admin_logs').doc(), {
        adminId: adminUserId,
        action: 'KYC_APPROVE',
        targetId: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    revalidatePath(`/profile/${userId}`);
    return successResponse(null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Approval failed';
    log.error('[kyc] approve failed', err, { userId, adminUserId, area: 'admin' });
    return errorResponse(ErrorType.INTERNAL, msg);
  }
}

export async function rejectKyc(userId: string, reason: string): Promise<ServiceResponse<null>> {
  const adminSession = await requireAdmin();
  const adminUserId = adminSession.user.id;
  if (!reason || reason.length < 5) {
    return errorResponse(ErrorType.VALIDATION, 'Rejection reason is required (min 5 chars)');
  }
  try {
    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(userId);
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('User not found');
      tx.update(userRef, {
        kycStatus: 'REJECTED' as KycStatus,
        kycReviewedAt: FieldValue.serverTimestamp(),
        kycReviewedBy: adminUserId,
        kycRejectReason: reason.slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('admin_logs').doc(), {
        adminId: adminUserId,
        action: 'KYC_REJECT',
        targetId: userId,
        reason: reason.slice(0, 500),
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return successResponse(null);
  } catch (err) {
    log.error('[kyc] reject failed', err, { userId, adminUserId, area: 'admin' });
    return errorResponse(ErrorType.INTERNAL, 'Rejection failed');
  }
}

/**
 * Re-sign a stored KYC doc URL so moderators always get a working link.
 *
 * The seller's upload (via /api/upload type='chat') returns a 7-day signed
 * URL that we persist in kycDocsRef. If a submission sits in the queue past
 * that window the stored link 404s. Here we extract the storage object path
 * from the stored URL and mint a fresh 1-hour signed URL at view time.
 * Best-effort: on any parse/sign failure we fall back to the stored URL.
 */
async function freshSignedUrl(storedUrl: unknown): Promise<string | undefined> {
  if (typeof storedUrl !== 'string' || !storedUrl) return undefined;
  try {
    const u = new URL(storedUrl);
    const bucket = adminStorage.bucket();
    // Signed-URL path is `/{bucket}/{objectPath}`; strip the bucket segment.
    let path = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    if (path.startsWith(`${bucket.name}/`)) path = path.slice(bucket.name.length + 1);
    if (!path) return storedUrl;
    const [fresh] = await bucket.file(path).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour — enough for one review
    });
    return fresh;
  } catch {
    return storedUrl;
  }
}

/**
 * Admin: list pending KYC submissions for the moderator queue.
 * Limited to 50 oldest-first so reviewers work through backlog.
 */
export async function listPendingKyc(): Promise<
  ServiceResponse<Array<{ userId: string; submittedAt: Date | null; docs: unknown }>>
> {
  await requireAdmin(); // throws if not admin
  try {
    const snap = await db
      .collection('users')
      .where('kycStatus', '==', 'PENDING')
      .orderBy('kycSubmittedAt', 'asc')
      .limit(50)
      .get();
    const rows = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as {
          kycSubmittedAt?: { toDate?: () => Date };
          kycDocsRef?: {
            nidFrontUrl?: string;
            nidBackUrl?: string;
            selfieUrl?: string;
            tradeLicenseUrl?: string;
          } | null;
        };
        const ref = data.kycDocsRef ?? null;
        // Mint fresh 1-hour signed URLs so links never 404 in the queue.
        const docs = ref
          ? {
              nidFrontUrl: await freshSignedUrl(ref.nidFrontUrl),
              nidBackUrl: await freshSignedUrl(ref.nidBackUrl),
              selfieUrl: await freshSignedUrl(ref.selfieUrl),
              tradeLicenseUrl: await freshSignedUrl(ref.tradeLicenseUrl),
            }
          : null;
        return {
          userId: d.id,
          submittedAt: data.kycSubmittedAt?.toDate?.() ?? null,
          docs,
        };
      }),
    );
    return successResponse(rows);
  } catch (err) {
    log.error('[kyc] list pending failed', err, { area: 'admin' });
    return errorResponse(ErrorType.INTERNAL, 'Could not load KYC queue');
  }
}
