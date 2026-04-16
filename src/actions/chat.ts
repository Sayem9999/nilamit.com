'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { filterPII } from '@/lib/pii-filter';
import { adminDB, rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';

export async function sendMessage(conversationId: string, content: string, imageUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const convSnap = await db.collection('conversations').doc(conversationId).get();
  if (!convSnap.exists) return { success: false, error: 'Conversation not found' };
  const conv = convSnap.data()!;

  if (conv.buyerId !== session.user.id && conv.sellerId !== session.user.id) {
    return { success: false, error: 'Forbidden' };
  }

  // Escrow must be HELD or RELEASED for chat to be active
  const escrowSnap = await db.collection('escrowTransactions').doc(conv.auctionId).get();
  if (!escrowSnap.exists) return { success: false, error: 'Escrow not found' };
  if (!['HELD', 'RELEASED'].includes(escrowSnap.data()!.status)) {
    return { success: false, error: 'Chat only available after advance payment.' };
  }

  const filtered = filterPII(content);
  const now      = new Date();
  const msgId    = db.collection('messages').doc().id;

  await db.collection('messages').doc(msgId).set({
    id: msgId, conversationId, senderId: session.user.id,
    content: filtered, imageUrl: imageUrl ?? null,
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
  }).catch(console.error);

  return { success: true, message: { id: msgId, content: filtered, createdAt: now } };
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
  const conv = convSnap.data()!;

  // SECURITY FIX: authorize BEFORE fetching messages
  if (conv.buyerId !== session.user.id && conv.sellerId !== session.user.id) return null;

  const messagesSnap = await db.collection('messages')
    .where('conversationId', '==', auctionId)
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get();

  const messages = messagesSnap.docs.map(d => ({
    ...d.data(), id: d.id,
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt),
  }));

  return {
    ...conv, id: convSnap.id,
    lastMessageAt: conv.lastMessageAt?.toDate?.() ?? new Date(conv.lastMessageAt),
    createdAt:     conv.createdAt?.toDate?.()     ?? new Date(conv.createdAt),
    messages,
  };
}
