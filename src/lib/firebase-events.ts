/**
 * firebase-events.ts — Firebase RTDB path helpers and event constants
 *
 * Replaces the PUSHER_EVENTS enum from pusher-server.ts.
 *
 * RTDB data structure:
 *
 *   /bids/auction/{auctionId}          — latest bid state (overwritten on each bid)
 *   /activity/auction/{auctionId}      — bid history feed (appended)
 *   /activity/global                   — global ticker (appended, pruned to last 20)
 *   /notifications/user/{userId}       — per-user notification queue (appended)
 *   /chat/conversation/{conversationId} — chat messages (appended)
 *   /presence/auction/{auctionId}/{userId} — viewer presence (set/removed)
 */

// ─── Path helpers ─────────────────────────────────────────────────────────────

export const RTDB_PATHS = {
  /** Latest bid on an auction (overwrite on each bid) */
  auctionBid:       (auctionId: string) => `bids/auction/${auctionId}`,

  /** Append-only activity feed for a specific auction */
  auctionActivity:  (auctionId: string) => `activity/auction/${auctionId}`,

  /** Global homepage activity ticker */
  globalActivity:   () => 'activity/global',

  /** Per-user notification inbox */
  userNotifications:(userId: string)    => `notifications/user/${userId}`,

  /** Chat messages for a conversation */
  conversation:     (conversationId: string) => `chat/conversation/${conversationId}`,

  /** Viewer presence for an auction */
  presence:         (auctionId: string, userId: string) => `presence/auction/${auctionId}/${userId}`,

  /** All viewers for an auction (parent of presence nodes) */
  presenceAuction:  (auctionId: string) => `presence/auction/${auctionId}`,
} as const;

// ─── Event type constants (stored as `event` field inside RTDB payloads) ─────

export const FIREBASE_EVENTS = {
  // Bidding
  NEW_BID:        'new_bid',
  AUCTION_CLOSED: 'auction_closed',
  AUCTION_SOLD:   'auction_sold',
  AUCTION_WON:    'auction_won',

  // Notifications
  OUTBID_ALERT:   'outbid_alert',
  PRICE_ALERT:    'price_alert',
  ENDING_SOON:    'ending_soon',
  TRUST_UPDATE:   'trust_update',
  ADVANCE_PAID:   'advance_paid',
  PII_VIOLATION:  'pii_violation',

  // Chat
  NEW_MESSAGE:          'new_message',
  CHAT_NOTIFICATION:    'chat_notification',
} as const;

export type FirebaseEvent = typeof FIREBASE_EVENTS[keyof typeof FIREBASE_EVENTS];
