/**
 * admin-guard.ts
 *
 * Single source of truth for admin authorization.
 * Import `requireAdmin` from here in all admin Server Actions.
 */

import 'server-only';
import { auth } from '@/lib/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

/**
 * Throws an Error if the current session user is not an admin.
 * Returns the session for convenience.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

/** True if the given email has admin privileges (useful for read-only guards) */
export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email));
}
