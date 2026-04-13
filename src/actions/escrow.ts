'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { pusherServer, PUSHER_EVENTS } from '@/lib/pusher-server';
import { EscrowStatus } from "@prisma/client";
import { recalculateUserReputation } from "@/lib/reputation";

/**
 * Transitions from PENDING -> HELD (The "Advance" payment)
 * Reveals contact information and secures the delivery fee/success fee.
 */
export async function payEscrowAdvance(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const tx = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
      include: { 
        auction: { select: { title: true, sellerId: true } },
        buyer: { select: { name: true } }
      }
    });

    if (!tx || tx.buyerId !== session.user.id) {
      return { success: false, error: 'Transaction not found or unauthorized' };
    }

    if (tx.status !== 'PENDING') {
      return { success: false, error: 'Advance has already been paid' };
    }

    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'HELD',
        paymentMethod: 'bkash_sim_advance',
      },
    });

    // Initialize Direct Chat Conversation
    const conversation = await prisma.conversation.upsert({
      where: { auctionId: tx.auctionId },
      create: {
        auctionId: tx.auctionId,
        buyerId: tx.buyerId,
        sellerId: tx.auction.sellerId,
        messages: {
          create: {
            senderId: 'system',
            content: 'Advance paid! You can now coordinate delivery details here.',
            isSystemMessage: true
          }
        }
      },
      update: {} // Already exists
    });

    // Notify Seller real-time
    await pusherServer.trigger(`private-user-${tx.auction.sellerId}`, PUSHER_EVENTS.ADVANCE_PAID, {
      auctionId: tx.auctionId,
      auctionTitle: tx.auction.title,
      buyerName: tx.buyer.name || 'A buyer',
      message: `Advance received! Delivery information for "${tx.auction.title}" is now unlocked.`
    });

    revalidatePath('/dashboard');
    revalidatePath(`/auctions/${tx.auctionId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to pay advance:', error);
    return { success: false, error: 'Internal error during advance payment' };
  }
}

/**
 * confirmItemReceived — Triggered by Buyer after successful COD delivery.
 * Releases the status and updates reputations.
 */
export async function confirmItemReceived(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.escrowTransaction.findUnique({
        where: { id: transactionId },
        include: { auction: true }
      });

      if (!transaction) throw new Error("Transaction not found");
      if (transaction.buyerId !== session.user.id) throw new Error("Unauthorized");
      if (transaction.status !== "HELD") throw new Error("Transaction is not in a valid state for confirmation.");

      // 1. Mark as released
      const updated = await tx.escrowTransaction.update({
        where: { id: transactionId },
        data: { 
          status: "RELEASED" as EscrowStatus,
          updatedAt: new Date()
        },
      });

      // 2. Automated Reputation Growth
      await recalculateUserReputation(transaction.auction.sellerId);
      await recalculateUserReputation(transaction.buyerId);

      // 3. Notify real-time trust updates
      await pusherServer.trigger(`private-user-${transaction.auction.sellerId}`, PUSHER_EVENTS.TRUST_UPDATE, {
        message: "Reputation improved! Successful sale confirmed.",
        newStatus: "RELEASED"
      });
      await pusherServer.trigger(`private-user-${transaction.buyerId}`, PUSHER_EVENTS.TRUST_UPDATE, {
        message: "Reputation improved! Successful purchase confirmed.",
        newStatus: "RELEASED"
      });

      return updated;
    });

    // Mark Auction as fully delivered
    await prisma.auction.update({
      where: { id: result.auctionId },
      data: {
        deliveryStatus: 'DELIVERED', 
      },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to confirm delivery:', error);
    return { success: false, error: 'Internal error during delivery confirmation' };
  }
}

/**
 * Refunds an escrow payment and waives the platform fee.
 * (Admin or Dispute Resolution context)
 */
export async function refundEscrow(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    const tx = await prisma.escrowTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) return { success: false, error: 'Transaction not found' };

    // Update Transaction to FEE_REFUNDED (waives the service fee logic)
    await prisma.escrowTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'FEE_REFUNDED',
      },
    });

    // Mark Auction as CANCELLED
    await prisma.auction.update({
      where: { id: tx.auctionId },
      data: {
        status: 'CANCELLED',
      },
    });

    revalidatePath('/dashboard/escrow');
    return { success: true };
  } catch (error) {
    console.error('Failed to refund escrow:', error);
    return { success: false, error: 'Internal server error during refund' };
  }
}
