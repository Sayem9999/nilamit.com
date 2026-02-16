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
  const highestBid = auction.bids[0];
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  if (highestBid) {
    const commissionEarned = highestBid.amount * (auction.commissionRate || 0.05);
    
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        status: AuctionStatus.SOLD,
        winnerId: highestBid.bidder.id,
        commissionEarned,
        deliveryStatus: OrderStatus.PENDING,
      },
    });

    // Notify Winner
    if (resend && highestBid.bidder.email) {
      await resend.emails.send({
        from: 'congrats@nilamit.com',
        to: highestBid.bidder.email,
        subject: `Congratulations! You won: ${auction.title}`,
        html: `<p>You won ${auction.title} for ৳${highestBid.amount.toLocaleString()}!</p>`,
      });
    }
  } else {
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: AuctionStatus.EXPIRED },
    });
  }

  return true;
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
  });

  for (const a of auctions) {
    await closeAuctionIfEnded(a.id);
  }
}
