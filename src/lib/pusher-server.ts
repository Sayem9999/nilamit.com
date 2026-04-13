import Pusher from 'pusher';

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export const PUSHER_EVENTS = {
  NEW_BID: 'new-bid',
  AUCTION_CLOSED: 'auction-closed',
  TRUST_UPDATE: 'trust-update',
  ADVANCE_PAID: 'advance-paid',
  PII_VIOLATION: 'pii-violation',
  CHAT_NOTIFICATION: 'chat-notification',
  NEW_MESSAGE: 'new-message',
} as const;
