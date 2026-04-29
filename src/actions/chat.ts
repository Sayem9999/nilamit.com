'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { filterPII } from '@/lib/pii-filter';
import { adminDB, rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { log } from '@/lib/logger';
import { sendMessageSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

export async function sendMessage(conversationId: string, content: string, imageUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Unauthorized');

  const parsed = sendMessageSchema.safeParse({ conversationId, content, imageUrl });
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const convSnap = await db.collection('conversations').doc(parsed.data.conversationId).get();
  if (!convSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Conversation not found');
  const conv = convSnap.data()!;

  if (conv.buyerId !== session.user.id && conv.sellerId !== session.user.id) {
    return errorResponse(ErrorType.FORBIDDEN, 'Forbidden');
  }

  // Escrow must be HELD or RELEASED for chat to be active
  const escrowSnap = await db.collection('escrowTransactions').doc(conv.auctionId).get();
  if (!escrowSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Escrow not found');
  if (!['HELD', 'RELEASED'].includes(escrowSnap.data()!.status)) {
    return errorResponse(ErrorType.FORBIDDEN, 'Chat only available after advance payment.');
  }

  const filtered = filterPII(parsed.data.content);
  const now      = new Date();
  const msgId    = db.collection('messages').doc().id;

  // buyerId/sellerId denormalized here so firestore.rules can authorize reads
  // with resource.data fields instead of a per-read get() call on conversations.
  await db.collection('messages').doc(msgId).set({
    id: msgId, conversationId: parsed.data.conversationId, senderId: session.user.id,
    buyerId: conv.buyerId, sellerId: conv.sellerId,
    content: filtered, imageUrl: parsed.data.imageUrl ?? null,
    isSystemMessage: false, isRead: false, createdAt: now,
  });

  await db.collection('conversations').doc(conversationId).update({ lastMessageAt: now });
  await adminDB.ref(`${RTDB_PATHS.conversation(conversationId)}/meta`).update({
    auctionId: conv.auctionId,
    participants: {
      [conv.buyerId]: true,
      [conv.sellerId]: true,
    },
  });
  await rtdbPush(RTDB_PATHS.conversation(conversationId), {
    event: FIREBASE_EVENTS.NEW_MESSAGE,
    id: msgId,
    senderId: session.user.id,
    content: filtered,
    imageUrl: imageUrl ?? null,
    createdAt: now.toISOString(),
  });

  const recipientId = session.user.id === conv.buyerId ? conv.sellerId : conv.buyerId;
  rtdbPush(RTDB_PATHS.userNotifications(recipientId), {
    event: FIREBASE_EVENTS.NEW_MESSAGE, conversationId, auctionId: conv.auctionId,
    senderName: session.user.name ?? 'Someone', preview: filtered.slice(0, 60),
  }).catch((e) => log.error('chat: recipient notification push failed', e));

  return successResponse({ id: msgId, content: filtered, createdAt: now });
}

export async function markAsRead(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const convSnap = await db.collection('conversations').doc(conversationId).get();
  if (!convSnap.exists) return;
  const conv = convSnap.data()!;
  if (conv.buyerId !== session.user.id && conv.sellerId !== session.user.id) return;

  const unreadSnap = await db.collection('messages')
    .where('conversationId', '==', conversationId)
    .where('senderId', '!=', session.user.id)
    .where('isRead', '==', false)
    .get();

  const batch = db.batch();
  unreadSnap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
  if (!unreadSnap.empty) await batch.commit();
}

export async function getAuctionChat(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const convSnap = await db.collection('conversations').doc(auctionId).get();
  if (!convSnap.exists) return null;
  const conv = convSnap.data()! as { buyerId: string; sellerId: string; auctionId: string; lastMessageAt: { toDate?: () => Date } | Date; createdAt: { toDate?: () => Date } | Date };

  // SECURITY FIX: authorize BEFORE fetching messages
  if (conv.buyerId !== session.user.id && conv.sellerId !== session.user.id) return null;

  const [messagesSnap, aSnap] = await Promise.all([
    db.collection('messages')
      .where('conversationId', '==', auctionId)
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get(),
    db.collection('auctions').doc(conv.auctionId).get(),
  ]);

  const messages = messagesSnap.docs.map((d) => {
    const m = d.data() as { content?: string; senderId: string; imageUrl?: string | null; isSystemMessage?: boolean; isRead?: boolean; createdAt: { toDate?: () => Date } | Date };
    const createdAt = m.createdAt instanceof Date ? m.createdAt : m.createdAt?.toDate?.() ?? new Date();
    return {
      id: d.id,
      content: m.content ?? '',
      senderId: m.senderId,
      imageUrl: m.imageUrl ?? null,
      isSystemMessage: Boolean(m.isSystemMessage),
      isRead: Boolean(m.isRead),
      createdAt,
    };
  });

  // Hydrate seller + winner for the recipient display in ChatInterface.
  const auction = aSnap.data() ?? {};
  const [sellerSnap, winnerSnap] = await Promise.all([
    auction.sellerId ? db.collection('users').doc(auction.sellerId).get() : Promise.resolve(null),
    auction.winnerId ? db.collection('users').doc(auction.winnerId).get() : Promise.resolve(null),
  ]);
  const seller = sellerSnap?.data() ?? {};
  const winner = winnerSnap?.data() ?? null;

  const lastMessageAt = conv.lastMessageAt instanceof Date ? conv.lastMessageAt : conv.lastMessageAt?.toDate?.() ?? new Date();
  const createdAt = conv.createdAt instanceof Date ? conv.createdAt : conv.createdAt?.toDate?.() ?? new Date();

  return {
    id: convSnap.id,
    auctionId: conv.auctionId,
    buyerId: conv.buyerId,
    sellerId: conv.sellerId,
    lastMessageAt,
    createdAt,
    messages,
    auction: {
      id: conv.auctionId,
      title: (auction.title as string) ?? '',
      seller: {
        name: (seller.name as string | null) ?? null,
        image: (seller.image as string | null) ?? null,
      },
      winner: winner
        ? { name: (winner.name as string | null) ?? null, image: (winner.image as string | null) ?? null }
        : null,
    },
  };
}
