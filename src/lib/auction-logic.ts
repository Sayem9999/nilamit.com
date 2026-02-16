import { prisma } from '@/lib/db';
import { Resend } from 'resend';

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

  if (!auction || (auction.status as string) !== 'ACTIVE') return false;

  const now = new Date();
  if (auction.endTime > now) return false;

  // Process closure
  const highestBid = auction.bids[0];
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  if (highestBid) {
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        status: 'SOLD' as any,
        winnerId: highestBid.bidder.id,
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
      data: { status: 'EXPIRED' as any },
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
      status: 'ACTIVE' as any,
      endTime: { lte: new Date() },
    },
  });

  for (const a of auctions) {
    await closeAuctionIfEnded(a.id);
  }
}
