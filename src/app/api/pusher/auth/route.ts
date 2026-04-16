/**
 * POST /api/pusher/auth
 *
 * Authenticates Pusher private and presence channel subscriptions.
 * Called automatically by pusher-js when subscribing to private-* or presence-* channels.
 *
 * Channel naming conventions enforced here:
 *   presence-auction-{id}      — Public bidding room (anyone can view)
 *   private-user-{userId}      — Personal notifications (session user only)
 *   private-conversation-{id}  — Chat (buyer or seller only)
 */

import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    if (!pusherServer || typeof pusherServer.authorizeChannel !== 'function') {
      return NextResponse.json(
        { error: 'Pusher auth is disabled. Realtime now uses Firebase.' },
        { status: 410 }
      );
    }

    const session = await auth();

    const data     = await req.formData();
    const socketId = data.get('socket_id') as string;
    const channel  = data.get('channel_name') as string;

    if (!socketId || !channel) {
      return new NextResponse('Missing socket_id or channel_name', { status: 400 });
    }

    // ── 1. Private user channel — session must match ────────
    if (channel.startsWith('private-user-')) {
      const channelUserId = channel.replace('private-user-', '');

      if (!session?.user?.id || session.user.id !== channelUserId) {
        return new NextResponse('Forbidden: user channel mismatch', { status: 403 });
      }

      const token = pusherServer.authorizeChannel(socketId, channel);
      return NextResponse.json(token);
    }

    // ── 2. Private conversation channel — buyer or seller only ─
    if (channel.startsWith('private-conversation-')) {
      if (!session?.user?.id) {
        return new NextResponse('Unauthorized: must be signed in', { status: 401 });
      }

      const conversationId = channel.replace('private-conversation-', '');
      const conversationSnap = await db.collection('conversations').doc(conversationId).get();
      if (!conversationSnap.exists) {
        return new NextResponse('Forbidden: conversation not found', { status: 403 });
      }

      const conversation = conversationSnap.data()!;
      const { buyerId, sellerId } = conversation;
      const isParticipant = session.user.id === buyerId || session.user.id === sellerId;

      if (!isParticipant) {
        return new NextResponse('Forbidden: not a conversation participant', { status: 403 });
      }

      const token = pusherServer.authorizeChannel(socketId, channel);
      return NextResponse.json(token);
    }

    // ── 3. Presence auction channel — all viewers allowed ──
    //    (even guests can watch bid counts, but names are anonymised)
    if (channel.startsWith('presence-auction-')) {
      const presenceData = {
        user_id: session?.user?.id ?? `guest_${socketId.slice(0, 8)}`,
        user_info: {
          name:    session?.user?.name  ?? 'Anonymous Viewer',
          image:   session?.user?.image ?? null,
          isGuest: !session?.user,
        },
      };

      const token = pusherServer.authorizeChannel(socketId, channel, presenceData);
      return NextResponse.json(token);
    }

    // ── 4. Any other private/presence channel — deny by default ─
    console.warn(`[Pusher Auth] Unrecognised channel pattern blocked: ${channel}`);
    return new NextResponse('Forbidden: unrecognised channel', { status: 403 });

  } catch (error) {
    console.error('[Pusher Auth] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
