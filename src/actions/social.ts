'use server';

import { db, snapDocs, docData } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Conversation, Auction, User, Message } from '@/types';

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
    rating: u.rating ?? 0,
    ratingCount: u.ratingCount ?? 0,
    winningStreak: u.winningStreak ?? 0,
    userLevel: u.userLevel ?? 1,
    isVerifiedSeller: u.isVerifiedSeller ?? false,
    badges: snapDocs<{ badgeId: string, earnedAt: Date }>(badgesSnap),
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
    const c = docData<Conversation>(d)!;
    const otherId = userId === c.buyerId ? c.sellerId : c.buyerId;

    const [aSnap, otherSnap, lastMsgSnap] = await Promise.all([
      db.collection('auctions').doc(c.auctionId).get(),
      db.collection('users').doc(otherId).get(),
      db.collection('messages')
        .where('conversationId', '==', c.id)
        .orderBy('createdAt', 'desc')
        .limit(1).get(),
    ]);

    const auction = docData<Auction>(aSnap);
    const otherUser = docData<User>(otherSnap);
    const lastMsg = lastMsgSnap.empty ? null : docData<Message>(lastMsgSnap.docs[0]);

    return {
      ...c,
      auction: auction ? { id: auction.id, title: auction.title, images: auction.images } : null,
      otherUser: { id: otherId, name: otherUser?.name ?? null, image: otherUser?.image ?? null },
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        createdAt: lastMsg.createdAt,
        isRead: lastMsg.isRead,
      } : null,
    };
  }));
}

export async function getLeaderboardData() {
  const volumeSnap = await db.collection('users')
    .orderBy('salesCount', 'desc')
    .limit(5)
    .get();

  const topMerchants = volumeSnap.docs.map(doc => {
    const data = doc.data() as User & { badges?: { badgeId: string }[] };
    return {
      id: doc.id,
      name: data.name,
      image: data.image,
      salesCount: data.salesCount || 0,
      badges: data.badges || [],
    };
  });

  const trustedSnap = await db.collection('users')
    .orderBy('rating', 'desc')
    .limit(5)
    .get();

  const topTrusted = trustedSnap.docs.map(doc => {
    const data = doc.data() as User & { badges?: { badgeId: string }[] };
    return {
      id: doc.id,
      name: data.name,
      image: data.image,
      badges: data.badges || [],
      rating: data.rating || 5.0,
      ratingCount: data.ratingCount || 0,
    };
  });

  return { topMerchants, topTrusted };
}
