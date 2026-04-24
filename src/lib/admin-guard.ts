/**
 * admin-guard.ts
 *
 * Single source of truth for admin authorization.
 * Import `requireAdmin` from here in all admin Server Actions.
 */

import 'server-only';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Session that's guaranteed to have a logged-in user with id + email.
 * `requireAdmin` throws if any of those are missing, so callers can rely
 * on the narrowed shape without re-checking for null.
 */
export type AdminSession = Session & {
  user: NonNullable<Session['user']> & { id: string; email: string };
};

/**
 * Throws an Error if the current session user is not an admin.
 * Returns the session (narrowed to non-null user) for convenience.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.id || !userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session as AdminSession;
}

/** True if the given email has admin privileges (useful for read-only guards) */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
