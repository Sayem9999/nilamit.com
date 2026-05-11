/**
 * firebase-email.ts — Transactional email for non-auth notifications (outbid, won, etc.)
 *
 * ⚠️  Verification emails are NOT sent here.
 *     Those are handled natively by Firebase Auth via sendNativeVerificationEmail()
 *     in src/lib/firebase-client.ts — Firebase's own infrastructure delivers them.
 *
 * This module writes outbid/auction-won/closing-soon notifications to the Firestore
 * `mail` collection. Wire up a real SMTP sender (verified Resend domain, SendGrid, etc.)
 * when you're ready — for now the docs are persisted for auditability and the full
 * email URL is logged to Cloud Logging so operators can monitor.
 */

import 'server-only';
import { adminFirestore } from '@/lib/firebase-admin';
import { log } from '@/lib/logger';

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Persists a transactional email to Firestore `mail` collection for audit purposes.
 * Wire up the Firebase "Trigger Email from Firestore" extension (or a Cloud Function)
 * to actually dispatch these when a verified sending domain is ready.
 */
export async function sendEmail({ to, subject, html, text, replyTo }: EmailPayload): Promise<void> {
  const message: Record<string, unknown> = { subject, html };
  if (text)    message.text    = text;
  if (replyTo) message.replyTo = replyTo;

  try {
    await adminFirestore.collection('mail').add({
      to: Array.isArray(to) ? to : [to],
      message,
      createdAt: new Date(),
      delivery: { state: 'PENDING' },
    });
    log.info('[firebase-email] Email queued in Firestore mail collection', {
      to: Array.isArray(to) ? to : [to],
      subject,
    });
  } catch (err) {
    log.error('[firebase-email] Failed to queue email in Firestore', err);
    throw err;
  }
}

// ─── Pre-built email senders ─────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'https://nilamit.com';

export async function sendOutbidEmail(
  email: string,
  title: string,
  currentPrice: number,
  auctionId: string,
): Promise<void> {
  const { outbidEmailHtml } = await import('@/lib/emails');
  await sendEmail({
    to: email,
    subject: `You've been outbid on: ${title}`,
    html: outbidEmailHtml(title, currentPrice, auctionId, BASE_URL),
  });
}

export async function sendAuctionWonEmail(
  email: string,
  title: string,
  winningPrice: number,
  auctionId: string,
): Promise<void> {
  const { auctionWonEmailHtml } = await import('@/lib/emails');
  await sendEmail({
    to: email,
    subject: `🎉 You won: ${title}!`,
    html: auctionWonEmailHtml(title, winningPrice, auctionId, BASE_URL),
  });
}

export async function sendEndingSoonEmail(
  email: string,
  title: string,
  currentPrice: number,
  auctionId: string,
): Promise<void> {
  const { auctionEndingSoonEmailHtml } = await import('@/lib/emails');
  await sendEmail({
    to: email,
    subject: `⏰ Closing Soon: ${title}`,
    html: auctionEndingSoonEmailHtml(title, currentPrice, auctionId, BASE_URL),
  });
}
