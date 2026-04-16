'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function getUserReputation(userId?: string) {
  const session = await auth();
  // If no userId provided, default to current user
  const targetId = userId ?? session?.user?.id;
  if (!targetId) return null;

  const [userSnap, badgesSnap] = await Promise.all([
    db.collection('users').doc(targetId).get(),
    db.collection('badges').where('userId', '==', targetId).get(),
  ]);

  if (!userSnap.exists) return null;
  const u = userSnap.data()!;
  return {
    id: targetId,
    name: u.name ?? null,
    image: u.image ?? null,
    reputationScore: u.reputationScore ?? 0,
    winningStreak: u.winningStreak ?? 0,
    userLevel: u.userLevel ?? 1,
    isVerifiedSeller: u.isVerifiedSeller ?? false,
    badges: badgesSnap.docs.map(d => ({ badgeId: d.data().badgeId, earnedAt: d.data().earnedAt?.toDate?.() ?? new Date() })),
  };
}

export async function getUserConversations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const [buyerSnap, sellerSnap] = await Promise.all([
    db.collection('conversations').where('buyerId', '==', userId).orderBy('lastMessageAt', 'desc').get(),
    db.collection('conversations').where('sellerId', '==', userId).orderBy('lastMessageAt', 'desc').get(),
  ]);

  const allConvs = [...buyerSnap.docs, ...sellerSnap.docs]
    .sort((a, b) => {
      const aTime = a.data().lastMessageAt?.toDate?.()?.getTime() ?? 0;
      const bTime = b.data().lastMessageAt?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    });

  return Promise.all(allConvs.map(async d => {
    const c = d.data();
    const otherId = userId === c.buyerId ? c.sellerId : c.buyerId;

    const [aSnap, otherSnap, lastMsgSnap] = await Promise.all([
      db.collection('auctions').doc(c.auctionId).get(),
      db.collection('users').doc(otherId).get(),
      db.collection('messages')
        .where('conversationId', '==', d.id)
        .orderBy('createdAt', 'desc')
        .limit(1).get(),
    ]);

    return {
      ...c, id: d.id,
      lastMessageAt: c.lastMessageAt?.toDate?.() ?? new Date(),
      auction: aSnap.exists ? { id: aSnap.id, title: aSnap.data()?.title ?? '', images: aSnap.data()?.images ?? [] } : null,
      otherUser: { id: otherId, name: otherSnap.data()?.name ?? null, image: otherSnap.data()?.image ?? null },
      lastMessage: lastMsgSnap.empty ? null : {
        content: lastMsgSnap.docs[0].data().content,
        createdAt: lastMsgSnap.docs[0].data().createdAt?.toDate?.() ?? new Date(),
        isRead: lastMsgSnap.docs[0].data().isRead,
      },
    };
  }));
}
