/**
 * chat-core.ts — shared coordination-chat send logic. Used by the web action
 * (src/actions/chat.ts::sendMessage) and the native bridge (/api/mobile/chat).
 * Server-only lib (not 'use server').
 */
import { db } from '@/lib/db';
import { filterPII } from '@/lib/pii-filter';
import { adminDB, rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { log } from '@/lib/logger';
import { sendMessageSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';

export async function sendMessageForUser(
  userId: string,
  userName: string | null,
  conversationId: string,
  content: string,
  imageUrl?: string,
): Promise<ServiceResponse<{ id: string; content: string; createdAt: Date }>> {
  const parsed = sendMessageSchema.safeParse({ conversationId, content, imageUrl });
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const convSnap = await db.collection('conversations').doc(parsed.data.conversationId).get();
  if (!convSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Conversation not found');
  const conv = convSnap.data()!;

  if (conv.buyerId !== userId && conv.sellerId !== userId) {
    return errorResponse(ErrorType.FORBIDDEN, 'Forbidden');
  }

  const escrowSnap = await db.collection('escrowTransactions').doc(conv.auctionId).get();
  if (!escrowSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Escrow not found');
  if (escrowSnap.data()!.status === 'REFUNDED') {
    return errorResponse(ErrorType.FORBIDDEN, 'Chat is closed because escrow was refunded.');
  }

  const filtered = filterPII(parsed.data.content);
  const now = new Date();
  const msgId = db.collection('messages').doc().id;

  await db.collection('messages').doc(msgId).set({
    id: msgId,
    conversationId: parsed.data.conversationId,
    senderId: userId,
    buyerId: conv.buyerId,
    sellerId: conv.sellerId,
    content: filtered,
    imageUrl: parsed.data.imageUrl ?? null,
    isSystemMessage: false,
    isRead: false,
    createdAt: now,
  });

  await db.collection('conversations').doc(conversationId).update({
    lastMessageAt: now,
    lastMessageContent: filtered.slice(0, 200),
    lastMessageSenderId: userId,
    updatedAt: now,
  });

  try {
    await adminDB.ref(`${RTDB_PATHS.conversation(conversationId)}/meta`).update({
      auctionId: conv.auctionId,
      participants: { [conv.buyerId]: true, [conv.sellerId]: true },
    });
    await rtdbPush(RTDB_PATHS.conversation(conversationId), {
      event: FIREBASE_EVENTS.NEW_MESSAGE,
      id: msgId,
      senderId: userId,
      content: filtered,
      imageUrl: imageUrl ?? null,
      createdAt: now.toISOString(),
    });

    const recipientId = userId === conv.buyerId ? conv.sellerId : conv.buyerId;
    rtdbPush(RTDB_PATHS.userNotifications(recipientId), {
      event: FIREBASE_EVENTS.NEW_MESSAGE,
      conversationId,
      auctionId: conv.auctionId,
      senderName: userName ?? 'Someone',
      preview: filtered.slice(0, 60),
      timestamp: Date.now(),
    }).catch((e) => log.error('[chat] recipient notification push failed', e, { area: 'chat', severity: 'warning' }));
  } catch (rtdbErr) {
    log.error('[chat] RTDB real-time signaling failed; gracefully falling back to Firestore', rtdbErr, {
      area: 'chat',
      severity: 'warning',
      conversationId,
      messageId: msgId,
    });
  }

  return successResponse({ id: msgId, content: filtered, createdAt: now });
}
