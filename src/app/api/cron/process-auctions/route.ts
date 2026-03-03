import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher-server';

// This would typically be called by a Vercel Cron or external scheduler every minute
export async function GET(request: Request) {
  // Simple auth check to ensure only the cron job can hit this
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();

    // Find all auctions that are ACTIVE but their endTime has passed
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        status: 'ACTIVE',
        endTime: { lte: now },
      },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1, // Only need the highest bid
        },
      },
    });

    if (expiredAuctions.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processedCount = 0;

    for (const auction of expiredAuctions) {
      const highestBid = auction.bids[0];

      await prisma.$transaction(async (tx) => {
        if (!highestBid) {
          // No bids -> Expired without sale
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          // Bids exist -> Sold -> Transition to Escrow
          await tx.auction.update({
            where: { id: auction.id },
            data: {
              status: 'SOLD',
              winnerId: highestBid.bidderId,
            },
          });

          // Create the Escrow Transaction in HELD status awaiting frontend interaction
          await tx.escrowTransaction.create({
            data: {
              auctionId: auction.id,
              buyerId: highestBid.bidderId,
              amount: highestBid.amount,
              status: 'HELD', // Initially held until payment is simulated
            },
          });

          // Notify the winner via WebSocket
          await pusherServer.trigger(`user-${highestBid.bidderId}`, 'auction-won', {
            auctionId: auction.id,
            title: auction.title,
            amount: highestBid.amount,
          }).catch(console.error);

          processedCount++;
        }
      });
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (error) {
    console.error('Failed processing auctions:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
