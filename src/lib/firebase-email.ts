/**
 * firebase-email.ts — Transactional email for non-auth notifications (outbid, won, etc.)
 *
 * ⚠️  Verification emails are NOT sent here.
 *     Those are handled natively by Firebase Auth via sendNativeVerificationEmail()
 *     in src/lib/firebase-client.ts — Firebase's own infrastructure delivers them.
 *
 * This module writes outbid/auction-won/closing-soon notifications to the Firestore
 * `mail` collection for auditability, and dispatches them via Resend API if RESEND_API_KEY
 * is provided.
 */

import 'server-only';
import { adminFirestore } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { log } from '@/lib/logger';

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      log.warn('[firebase-email] RESEND_API_KEY is missing. Only writing to firestore collection.');
      return null;
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Persists a transactional email to Firestore `mail` collection and sends via Resend if configured.
 */
export async function sendEmail({ to, subject, html, text, replyTo }: EmailPayload): Promise<void> {
  const message: Record<string, unknown> = { subject, html };
  if (text)    message.text    = text;
  if (replyTo) message.replyTo = replyTo;

  try {
    const docRef = await adminFirestore.collection('mail').add({
      to: Array.isArray(to) ? to : [to],
      message,
      createdAt: new Date(),
      delivery: { state: 'PENDING' },
    });

    const resend = getResend();
    if (resend) {
      log.info(`[firebase-email] Sending email via Resend API`, { to, subject });
      const emailResponse = await resend.emails.send({
        from: 'Nilamit <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        replyTo,
      });

      if (emailResponse.error) {
        log.error('[firebase-email] Resend API delivery failed', emailResponse.error);
        await docRef.update({
          'delivery.state': 'ERROR',
          'delivery.error': emailResponse.error.message,
        });
      } else {
        log.info('[firebase-email] Email delivered successfully via Resend API', { id: emailResponse.data?.id });
        await docRef.update({
          'delivery.state': 'SUCCESS',
          'delivery.sentAt': new Date(),
        });
      }
    } else {
      log.warn('[firebase-email] Resend API key not available. Email written to mail collection but not dispatched.');
    }
  } catch (err) {
    log.error('[firebase-email] Failed to queue/send email', err);
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
