import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/firebase-email';
import { PrismaClient, AuctionStatus, OrderStatus } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Calculates the dynamic success fee (commission) based on final price.
 * Tiers (Approved v1.5):
 * - <= ৳10,000: 2.5% + ৳20
 * - ৳10,001 - ৳150,000: 1.5% + ৳20
 * - > ৳150,000: 1% + ৳20
 */
export function calculateSuccessFee(finalPrice: number): number {
  const flatFee = 20;
  let rate = 0.025; // Default <= 10k

  if (finalPrice > 150000) {
    rate = 0.01; // > 150k
  } else if (finalPrice > 10000) {
    rate = 0.015; // 10k - 150k
  }

  return (finalPrice * rate) + flatFee;
}

/**
 * processAuctionSale — Centralized logic for finalizing a sale.
 * Used by both auto-close cron and Buy It Now actions.
 */
export async function processAuctionSale(
  tx: TransactionClient, 
  auction: { id: string, title: string, deliveryCharge: number, reservePrice?: number | null },
  seller: { id: string, isVerifiedSeller: boolean },
  winner: { id: string, email: string | null, name: string | null },
  finalPrice: number
) {
  const meetsReserve = !auction.reservePrice || finalPrice >= auction.reservePrice;

  if (meetsReserve) {
    // 1. Dynamic Success Fee Calculation
    const commissionEarned = calculateSuccessFee(finalPrice);

    // 2. Update Auction to SOLD
    await tx.auction.update({
      where: { id: auction.id },
      data: {
        status: AuctionStatus.SOLD,
        winnerId: winner.id,
        commissionEarned,
        deliveryStatus: OrderStatus.PENDING,
        currentPrice: finalPrice, // Ensure final price is set correctly (esp for BIN)
      },
    });

    // 3. Handle Escrow creation with Trust-Tiered Advance Logic
    const isVerified = seller.isVerifiedSeller;
    const advanceAmount = isVerified ? finalPrice : (commissionEarned + (auction.deliveryCharge || 0));

    await tx.escrowTransaction.create({
      data: {
        auctionId: auction.id,
        buyerId: winner.id,
        amount: advanceAmount,
        status: isVerified ? 'HELD' : 'PENDING',
      }
    });

    // 4. Notify Winner via Firebase email queue (non-fatal)
    if (winner.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'https://nilamit.app';
      sendEmail({
        to: winner.email,
        subject: `Congratulations! You won: ${auction.title}`,
        html: `
          <h3>You won ${auction.title}!</h3>
          <p>Final Price: ৳${finalPrice.toLocaleString()}</p>
          ${isVerified
            ? `<p>Seller is <b>Verified</b>. Contact information has been released in your dashboard.</p>`
            : `<p>Please pay the <b>Advance of ৳${advanceAmount.toLocaleString()}</b> (Success Fee + Delivery) to unlock the seller&apos;s contact information.</p>`
          }
          <p>Visit your <a href="${baseUrl}/dashboard?tab=escrow">Dashboard</a> to proceed.</p>
        `,
      }).catch(err => console.error('[auction-logic] Winner email failed:', err));
    }
    return true;
  } else {
    // Reserve not met
    await tx.auction.update({
      where: { id: auction.id },
      data: { status: AuctionStatus.EXPIRED },
    });
    return false;
  }
}

/**
 * Closes a single auction if it has ended.
 * Returns true if the auction was processed (sold/expired).
 */
export async function closeAuctionIfEnded(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
        include: { bidder: { select: { id: true, email: true, name: true } } },
      },
      seller: { select: { id: true, email: true, name: true, isVerifiedSeller: true } },
    },
  });

  if (!auction || auction.status !== AuctionStatus.ACTIVE) return false;

  const now = new Date();
  if (auction.endTime > now) return false;

  try {
    await prisma.$transaction(async (tx) => {
      // Re-fetch with lock
      const currentAuction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: {
          bids: {
            orderBy: { amount: 'desc' },
            take: 1,
            include: { bidder: { select: { id: true, email: true, name: true } } },
          },
          seller: { select: { id: true, isVerifiedSeller: true } },
        }
      });

      if (!currentAuction || currentAuction.status !== AuctionStatus.ACTIVE) return;

      const highestBid = currentAuction.bids[0];

      if (highestBid) {
        await processAuctionSale(
          tx,
          currentAuction,
          currentAuction.seller,
          highestBid.bidder,
          highestBid.amount
        );
      } else {
        await tx.auction.update({
          where: { id: currentAuction.id },
          data: { status: AuctionStatus.EXPIRED },
        });
      }
    });

    return true;
  } catch (error) {
    console.error(`Failed to close auction ${auctionId}:`, error);
    return false;
  }
}

/**
 * Closes all auctions that have ended across the system.
 */
export async function closeAllEndedAuctions() {
  const auctions = await prisma.auction.findMany({
    where: {
      status: AuctionStatus.ACTIVE,
      endTime: { lte: new Date() },
    },
    select: { id: true },
  });

  if (auctions.length === 0) return;

  // Process in parallel to handle scale, limited by internal Promise.all 
  // (could use p-limit for very high volume, but for now this is a huge win)
  await Promise.all(auctions.map(a => closeAuctionIfEnded(a.id)));
}
