import { prisma } from '@/lib/db';
import { Resend } from 'resend';
import { AuctionStatus, OrderStatus } from '@prisma/client';

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
      seller: { select: { email: true, name: true } },
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
        }
      });

      if (!currentAuction || currentAuction.status !== AuctionStatus.ACTIVE) return;

      const highestBid = currentAuction.bids[0];

      if (highestBid) {
        const meetsReserve = !currentAuction.reservePrice || highestBid.amount >= currentAuction.reservePrice;

        if (meetsReserve) {
          const commissionEarned = highestBid.amount * (currentAuction.commissionRate || 0.05);

          await tx.auction.update({
            where: { id: currentAuction.id },
            data: {
              status: AuctionStatus.SOLD,
              winnerId: highestBid.bidder.id,
              commissionEarned,
              deliveryStatus: OrderStatus.PENDING,
            },
          });

          // Handle Escrow creation (Phase 10)
          await tx.escrowTransaction.create({
            data: {
              auctionId: currentAuction.id,
              buyerId: highestBid.bidder.id,
              amount: highestBid.amount,
              status: 'PENDING',
            }
          });

          // Notify Winner
          if (resend && highestBid.bidder.email) {
            await resend.emails.send({
              from: 'congrats@nilamit.com',
              to: highestBid.bidder.email,
              subject: `Congratulations! You won: ${currentAuction.title}`,
              html: `<p>You won ${currentAuction.title} for ৳${highestBid.amount.toLocaleString()}!</p>`,
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
