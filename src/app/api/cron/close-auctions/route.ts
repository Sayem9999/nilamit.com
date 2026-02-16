import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 1. Security check (Internal/Cron only)
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();

    // 2. Find auctions that should be closed (ACTIVE and endTime reached)
    const auctionsToClose = await prisma.auction.findMany({
      where: {
        status: 'ACTIVE',
        endTime: { lte: now },
      },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: { bidder: { select: { id: true, email: true, name: true } } },
        },
        seller: { select: { email: true, name: true } },
      },
    });

    if (auctionsToClose.length === 0) {
      return NextResponse.json({ message: 'No auctions to close.' });
    }

    const results = [];
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

    for (const auction of auctionsToClose) {
      const highestBid = auction.bids[0];

      if (highestBid) {
        // High bidder found -> SOLD
        await prisma.auction.update({
          where: { id: auction.id },
          data: {
            status: 'SOLD',
            winnerId: highestBid.bidder.id,
          },
        });

        // Notify Winner
        if (resend && highestBid.bidder.email) {
          await resend.emails.send({
            from: 'congrats@nilamit.com',
            to: highestBid.bidder.email,
            subject: `Congratulations! You won: ${auction.title}`,
            html: `
              <h2>You won the auction!</h2>
              <p>Your bid of <strong>৳${highestBid.amount.toLocaleString()}</strong> was the highest for <strong>${auction.title}</strong>.</p>
              <p>The seller has been notified. They will contact you shortly.</p>
              <p><a href="${process.env.NEXTAUTH_URL}/auctions/${auction.id}">View Auction Details</a></p>
            `,
          });
        }

        // Notify Seller
        if (resend && auction.seller.email) {
          await resend.emails.send({
            from: 'sales@nilamit.com',
            to: auction.seller.email,
            subject: `Your item has SOLD: ${auction.title}`,
            html: `
              <h2>Good news! Your auction sold.</h2>
              <p><strong>${highestBid.bidder.name || 'A buyer'}</strong> won <strong>${auction.title}</strong> for <strong>৳${highestBid.amount.toLocaleString()}</strong>.</p>
              <p>Please coordinate the handover/delivery with the buyer.</p>
              <p><a href="${process.env.NEXTAUTH_URL}/auctions/${auction.id}">View Sale Details</a></p>
            `,
          });
        }

        results.push({ id: auction.id, outcome: 'SOLD', winner: highestBid.bidder.id });
      } else {
        // No bids -> EXPIRED
        await prisma.auction.update({
          where: { id: auction.id },
          data: { status: 'EXPIRED' },
        });

        // Notify Seller
        if (resend && auction.seller.email) {
          await resend.emails.send({
            from: 'updates@nilamit.com',
            to: auction.seller.email,
            subject: `Your auction expired: ${auction.title}`,
            html: `
              <h2>Auction Expired</h2>
              <p>Unfortunately, your auction for <strong>${auction.title}</strong> ended with no bids.</p>
              <p>You can relist the item with a lower starting price to attract more bidders.</p>
            `,
          });
        }

        results.push({ id: auction.id, outcome: 'EXPIRED' });
      }
    }

    return NextResponse.json({ 
      message: `Processed ${auctionsToClose.length} auctions.`,
      results 
    });

  } catch (error) {
    console.error('[CRON ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
