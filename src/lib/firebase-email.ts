/**
 * firebase-email.ts — Transactional email via Firebase Trigger Email extension
 *
 * Replaces Resend.
 *
 * How it works:
 *   1. We write a document to the Firestore `mail` collection.
 *   2. The Firebase "Trigger Email from Firestore" extension picks it up and
 *      sends the email via the configured SMTP provider (e.g. SendGrid, Mailgun,
 *      or any SMTP server).
 *
 * Setup (one-time, in Firebase Console):
 *   Extensions → "Trigger Email from Firestore" → Install
 *   Configure with your SMTP connection URI, e.g.:
 *     smtps://apikey:<SENDGRID_API_KEY>@smtp.sendgrid.net:465
 *   Or for Gmail:
 *     smtps://<email>:<app_password>@smtp.gmail.com:465
 *
 * The extension monitors the `mail` collection and sends each document once,
 * then marks it `delivery.state = 'SUCCESS'` or `'ERROR'`.
 */

import 'server-only';
import { adminFirestore } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { log } from '@/lib/logger';

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;           // Optional plain-text fallback
  replyTo?: string;        // Optional reply-to address
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
 * Sends a transactional email.
 * Delivers instantly via Resend API and writes a copy to Firestore 'mail' collection for history & auditing.
 */
export async function sendEmail({ to, subject, html, text, replyTo }: EmailPayload): Promise<void> {
  const message: Record<string, unknown> = { subject, html };
  if (text)    message.text    = text;
  if (replyTo) message.replyTo = replyTo;

  try {
    // 1. Create a log record in Firestore mail collection
    const docRef = await adminFirestore.collection('mail').add({
      to: Array.isArray(to) ? to : [to],
      message,
      createdAt: new Date(),
    });

    // 2. Dispatch via Resend API if available
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
    log.error('[firebase-email] sendEmail failed', err);
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
