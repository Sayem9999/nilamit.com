import PusherClient from 'pusher-js';

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: '/api/pusher/auth',
    activityTimeout: 60000,   // Increase heartbeat interval for mobile data savings
    unavailableTimeout: 10000, // Detect offline faster (10s)
    enabledTransports: ['ws', 'wss'], // Force WebSockets for lower latency
  }
);
