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

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;           // Optional plain-text fallback
  replyTo?: string;        // Optional reply-to address
}

/**
 * Queue a transactional email.
 * Returns immediately — delivery is async via the Firebase extension.
 */
export async function sendEmail({ to, subject, html, text, replyTo }: EmailPayload): Promise<void> {
  const message: Record<string, unknown> = { subject, html };
  if (text)    message.text    = text;
  if (replyTo) message.replyTo = replyTo;

  await adminFirestore.collection('mail').add({
    to: Array.isArray(to) ? to : [to],
    message,
    createdAt: new Date(),
  });
}

// ─── Pre-built email senders ─────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'https://nilamit--nilamit-52073.asia-southeast1.hosted.app';

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
