'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return null;
  }
  return session;
}

export async function grantVerifiedSeller(userId: string) {
  if (!(await requireAdmin())) return { success: false, error: 'Not authorized' };
  await prisma.user.update({ where: { id: userId }, data: { isVerifiedSeller: true } });
  return { success: true };
}

export async function revokeVerifiedSeller(userId: string) {
  if (!(await requireAdmin())) return { success: false, error: 'Not authorized' };
  await prisma.user.update({ where: { id: userId }, data: { isVerifiedSeller: false } });
  return { success: true };
}

export async function getAdminUsers() {
  if (!(await requireAdmin())) return { success: false, users: [] };

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, image: true,
      isVerifiedSeller: true, isPhoneVerified: true, reputationScore: true, createdAt: true,
      _count: { select: { bids: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return { success: true, users };
}
