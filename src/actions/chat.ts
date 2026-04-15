'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { filterPII } from '@/lib/pii-filter';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { revalidatePath } from 'next/cache';

/**
 * Send a message within an auction coordination chat
 */
export async function sendMessage(auctionId: string, content: string, imageUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { auctionId },
      include: {
        auction: {
          include: {
            escrowTransaction: {
              select: { status: true }
            }
          }
        }
      }
    });

    if (!conversation) return { success: false, error: 'Conversation not found' };

    // Verify Authorization: Only buyer or seller
    const isPlayer = conversation.buyerId === session.user.id || conversation.sellerId === session.user.id;
    if (!isPlayer) return { success: false, error: 'Unauthorized' };

    // Verify Status: Must be HELD or RELEASED
    const status = conversation.auction.escrowTransaction?.status;
    if (status !== 'HELD' && status !== 'RELEASED') {
      return { success: false, error: 'Chat is locked until advance payment is confirmed.' };
    }

    // Process Content
    const sanitizedContent = filterPII(content);

    // Save Message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: session.user.id,
        content: sanitizedContent,
        imageUrl,
      },
      include: {
         conversation: {
           select: { buyerId: true, sellerId: true }
         }
      }
    });

    // Update lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    // Push message to Firebase RTDB conversation path
    const recipientId = session.user.id === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    await rtdbPush(RTDB_PATHS.conversation(conversation.id), {
      event:    FIREBASE_EVENTS.NEW_MESSAGE,
      id:       message.id,
      content:  message.content,
      imageUrl: message.imageUrl ?? null,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
    });

    // Push chat notification to recipient's inbox
    await rtdbPush(RTDB_PATHS.userNotifications(recipientId), {
      event:    FIREBASE_EVENTS.CHAT_NOTIFICATION,
      auctionId,
      message:  `New message for ${conversation.auction.title}`,
    });

    return { success: true, message };
  } catch (error) {
    console.error('Failed to send message:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Mark messages in a conversation as read
 */
export async function markAsRead(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: session.user.id },
        isRead: false
      },
      data: { isRead: true }
    });

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Get messages and conversation metadata for an auction
 */
export async function getAuctionChat(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const convo = await prisma.conversation.findUnique({
      where: { auctionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100
        },
        auction: {
          select: {
             title: true,
             seller: { select: { name: true, image: true, reputationScore: true } },
             winner: { select: { name: true, image: true, reputationScore: true } }
          }
        }
      }
    });

    if (!convo) return null;

    // Verify Access
    if (convo.buyerId !== session.user.id && convo.sellerId !== session.user.id) {
      return null;
    }

    return convo;
  } catch (error) {
    return null;
  }
}
