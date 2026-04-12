import { prisma } from '@/lib/db';
import { Resend } from 'resend';
import { AuctionStatus, OrderStatus } from '@prisma/client';

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
      seller: { select: { email: true, name: true, isVerifiedSeller: true } },
    },
  });

  if (!auction || auction.status !== AuctionStatus.ACTIVE) return false;

  const now = new Date();
  if (auction.endTime > now) return false;

  // Process closure
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
        const meetsReserve = !currentAuction.reservePrice || highestBid.amount >= currentAuction.reservePrice;

        if (meetsReserve) {
          // Dynamic Success Fee Calculation
          const commissionEarned = calculateSuccessFee(highestBid.amount);

          await tx.auction.update({
            where: { id: currentAuction.id },
            data: {
              status: AuctionStatus.SOLD,
              winnerId: highestBid.bidder.id,
              commissionEarned,
              deliveryStatus: OrderStatus.PENDING,
            },
          });

          // Handle Escrow creation with Trust-Tiered Advance Logic
          // Verified Sellers get instant revelation (status: HELD)
          // New Sellers require Success Fee + Delivery Charge Advance (status: PENDING)
          const isVerified = currentAuction.seller?.isVerifiedSeller ?? false;
          const advanceAmount = isVerified ? highestBid.amount : (commissionEarned + (currentAuction.deliveryCharge || 0));

          await tx.escrowTransaction.create({
            data: {
              auctionId: currentAuction.id,
              buyerId: highestBid.bidder.id,
              amount: advanceAmount,
              status: isVerified ? 'HELD' : 'PENDING',
            }
          });

          // Notify Winner
          if (resend && highestBid.bidder.email) {
            await resend.emails.send({
              from: 'congrats@nilamit.com',
              to: highestBid.bidder.email,
              subject: `Congratulations! You won: ${currentAuction.title}`,
              html: `
                <h3>You won ${currentAuction.title}!</h3>
                <p>Final Price: ৳${highestBid.amount.toLocaleString()}</p>
                ${isVerified 
                  ? `<p>Seller is <b>Verified</b>. Contact information has been released in your dashboard.</p>` 
                  : `<p>Please pay the <b>Advance of ৳${advanceAmount.toLocaleString()}</b> (Success Fee + Delivery) to unlock the seller's contact information.</p>`
                }
                <p>Visit your <a href="${process.env.NEXTAUTH_URL}/dashboard?tab=escrow">Dashboard</a> to proceed.</p>
              `,
            });
          }
        } else {
          // Reserve not met
          await tx.auction.update({
            where: { id: currentAuction.id },
            data: { status: AuctionStatus.EXPIRED },
          });
        }
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
