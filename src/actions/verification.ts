'use server';

/**
 * Identity Hardening (Tier 2) server actions.
 *
 * Covers three verification flows for seller badges:
 *   1. Email OTP — user-initiated, self-serve. Marks `emailVerified` timestamp.
 *   2. NID (Bangladeshi National ID) — user submits number + front/back photos.
 *      Goes to a `PENDING` queue; admin approves/rejects from the admin panel.
 *   3. (Phone verification already lives in src/actions/phone.ts)
 *
 * NID image files are uploaded via /api/upload with type='nid' — which stores
 * them in a PRIVATE bucket path. The actual URLs are signed-only, minted by
 * `getNIDSignedUrls()` for the owning user or an admin.
 */

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Resend } from 'resend';
import { adminStorage } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { NIDStatus } from '@/types';

const OTP_EXPIRY_MS        = 10 * 60 * 1000;   // 10 min
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const MAX_OTP_PER_HOUR     = 5;
const SIGNED_URL_TTL_MS    = 15 * 60 * 1000;   // 15 min

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function hashNID(nid: string): string {
  // Salt with a project-specific pepper when configured; otherwise plain SHA-256.
  const pepper = process.env.NID_HASH_PEPPER ?? '';
  return crypto.createHash('sha256').update(`${pepper}:${nid}`).digest('hex');
}

// ─── Email OTP ─────────────────────────────────────────────────────────────

export async function sendEmailVerificationOTP() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { success: false, error: 'You must be logged in with an email.' };
  }
  const email  = session.user.email;
  const userId = session.user.id;

  // Rate limit
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const rateSnap   = await db.collection('emailVerifications')
    .where('userId', '==', userId)
    .where('createdAt', '>', oneHourAgo)
    .get();
  if (rateSnap.size >= MAX_OTP_PER_HOUR) {
    return { success: false, error: 'Too many OTP requests. Try again in an hour.' };
  }

  const otp = generateOTP();
  const ref = db.collection('emailVerifications').doc();
  const now = new Date();

  await ref.set({
    id: ref.id,
    userId,
    email,
    otp: hashOTP(otp),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    verified: false,
    createdAt: now,
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    // Dev-mode: surface the code in logs. Never in production.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[verification] RESEND_API_KEY missing — dev OTP for ${email}: ${otp}`);
      return { success: true };
    }
    return { success: false, error: 'Email service not configured.' };
  }
  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Verify your nilamit.com email',
      html: `<p>Your email verification code is <strong>${otp}</strong>. Valid for 10 minutes.</p>`,
    });
    if (error) return { success: false, error: 'Failed to send email.' };
    return { success: true };
  } catch (e) {
    console.error('[verification] sendEmailOTP error', e);
    return { success: false, error: 'Failed to send email.' };
  }
}

export async function verifyEmailOTP(otp: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'You must be logged in.' };
  const userId = session.user.id;

  const snap = await db.collection('emailVerifications')
    .where('userId', '==', userId)
    .where('otp', '==', hashOTP(otp))
    .where('verified', '==', false)
    .where('expiresAt', '>', new Date())
    .orderBy('expiresAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return { success: false, error: 'Invalid or expired code.' };

  const now = new Date();
  await snap.docs[0].ref.update({ verified: true, verifiedAt: now });
  await db.collection('users').doc(userId).update({
    emailVerified: now,
    updatedAt: now,
  });
  return { success: true };
}

// ─── NID Submission ─────────────────────────────────────────────────────────

/**
 * Bangladeshi NIDs are either 10 digits (new smart card) or 13/17 digits
 * (legacy). We accept 10, 13, or 17 digits.
 */
function isValidNIDNumber(nid: string): boolean {
  return /^\d{10}$|^\d{13}$|^\d{17}$/.test(nid);
}

export async function submitNIDVerification(input: {
  nidNumber: string;
  frontPath: string;
  backPath: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'You must be logged in.' };
  const userId = session.user.id;

  const nidNumber = input.nidNumber.replace(/\s+/g, '');
  if (!isValidNIDNumber(nidNumber)) {
    return { success: false, error: 'NID number must be 10, 13, or 17 digits.' };
  }
  if (!input.frontPath || !input.backPath) {
    return { success: false, error: 'Both front and back photos are required.' };
  }
  // Paths must live under the user's private NID folder (defense-in-depth)
  const expectedPrefix = `nid/${userId}/`;
  if (!input.frontPath.startsWith(expectedPrefix) || !input.backPath.startsWith(expectedPrefix)) {
    return { success: false, error: 'Invalid image paths.' };
  }

  // Prevent re-submitting an NID number already claimed by another user
  const nidHash    = hashNID(nidNumber);
  const existSnap  = await db.collection('users')
    .where('nidNumberHash', '==', nidHash)
    .limit(1).get();
  if (!existSnap.empty && existSnap.docs[0].id !== userId) {
    return { success: false, error: 'This NID number is already registered to another account.' };
  }

  const now = new Date();
  await db.collection('users').doc(userId).update({
    nidStatus:          NIDStatus.PENDING,
    nidNumberHash:      nidHash,
    nidLast4:           nidNumber.slice(-4),
    nidFrontPath:       input.frontPath,
    nidBackPath:        input.backPath,
    nidSubmittedAt:     now,
    nidRejectionReason: null,
    updatedAt:          now,
  });
  return { success: true };
}

export async function getMyNIDStatus() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
  const snap = await db.collection('users').doc(session.user.id).get();
  if (!snap.exists) return { success: false, error: 'Not found' };
  const u = snap.data()!;
  return {
    success: true as const,
    status:              (u.nidStatus as NIDStatus | undefined) ?? NIDStatus.NONE,
    last4:               (u.nidLast4 as string | null | undefined) ?? null,
    rejectionReason:     (u.nidRejectionReason as string | null | undefined) ?? null,
    submittedAt:         u.nidSubmittedAt?.toDate?.() ?? u.nidSubmittedAt ?? null,
    isNIDVerified:       Boolean(u.isNIDVerified),
  };
}

// ─── Signed URLs for NID images (admin or owner only) ────────────────────────

export async function getNIDSignedUrls(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  const isAdmin     = Boolean(session.user.email && adminEmails.includes(session.user.email));
  const isOwner     = session.user.id === targetUserId;
  if (!isAdmin && !isOwner) return { success: false, error: 'Forbidden' };

  const snap = await db.collection('users').doc(targetUserId).get();
  if (!snap.exists) return { success: false, error: 'Not found' };
  const u = snap.data()!;
  const frontPath = u.nidFrontPath as string | undefined;
  const backPath  = u.nidBackPath as string | undefined;
  if (!frontPath || !backPath) return { success: false, error: 'No NID images on file.' };

  try {
    const bucket  = adminStorage.bucket();
    const expires = Date.now() + SIGNED_URL_TTL_MS;
    const [frontUrl] = await bucket.file(frontPath).getSignedUrl({ action: 'read', expires });
    const [backUrl]  = await bucket.file(backPath).getSignedUrl({ action: 'read', expires });
    return { success: true as const, frontUrl, backUrl, expiresAt: new Date(expires) };
  } catch (e) {
    console.error('[verification] getNIDSignedUrls error', e);
    return { success: false, error: 'Failed to mint signed URLs.' };
  }
}
