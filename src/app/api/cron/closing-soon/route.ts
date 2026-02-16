import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return NextResponse.json({ error: 'Resend API key missing' }, { status: 500 });

  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find active auctions ending in the next hour that haven't been notified yet
    // Note: We might want a 'notifiedClosingSoon' flag in the Auction model for better scaling,
    // but for now we'll just process them based on timing.
    const auctions = await prisma.auction.findMany({
      where: {
        status: 'ACTIVE' as any,
        endTime: {
          gt: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        watchlist: {
          include: {
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    let sentCount = 0;

    for (const auction of auctions) {
      for (const entry of auction.watchlist) {
        if (entry.user.email) {
          await resend.emails.send({
            from: 'alerts@nilamit.com',
            to: entry.user.email,
            subject: `Closing Soon: ${auction.title}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6366f1;">Action Required!</h2>
                <p>Hi ${entry.user.name || 'Bidder'},</p>
                <p>An item on your watchlist is closing in less than an hour!</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin: 20px 0;">
                  <strong style="font-size: 18px;">${auction.title}</strong><br/>
                  <span style="color: #64748b;">Current Bid: ৳${auction.currentPrice.toLocaleString()}</span>
                </div>
                <a href="${process.env.NEXTAUTH_URL}/auctions/${auction.id}" 
                   style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Place a Bid Now
                </a>
              </div>
            `,
          });
          sentCount++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      auctionsProcessed: auctions.length,
      emailsSent: sentCount
    });

  } catch (error) {
    console.error('[CRON CLOSING SOON ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
