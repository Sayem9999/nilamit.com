import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';
import { auth } from '@/lib/auth';

/**
 * Endpoint for Pusher Presence/Private Channel Authentication
 * Called automatically by pusher-js when subscribing to private-* or presence-* channels
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const data = await req.formData();
    const socketId = data.get('socket_id') as string;
    const channel = data.get('channel_name') as string;

    // ── Channel Authorization Logic ──────────────────
    
    // Private User Channels: Must match session ID
    if (channel.startsWith('private-user-')) {
      const userId = channel.replace('private-user-', '');
      if (session?.user?.id !== userId) {
        return new NextResponse('Unauthorized Channel Access', { status: 403 });
      }
    }

    // Determine the user details for presence channel
    const presenceData = {
      user_id: session?.user?.id || `anonymous_${Math.random().toString(36).substring(7)}`,
      user_info: {
        name: session?.user?.name || 'Anonymous Viewer',
        image: session?.user?.image || null,
        isGuest: !session?.user,
      },
    };

    // Authenticate the subscription
    const authResponse = pusherServer.authorizeChannel(socketId, channel, presenceData);
    
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
