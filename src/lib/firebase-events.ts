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

  /** Auction closure/status updates (SOLD/EXPIRED) */
  auctionStatus:    (auctionId: string) => `status/auction/${auctionId}`,

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

  // Payments & Escrow
  PAYMENT_SUCCESS:      'payment_success',
  ESCROW_HELD:          'escrow_held',

  // Discovery / fan-out
  NEW_LISTING:          'new_listing',          // pushed to followers when a seller publishes
  NEW_QUESTION:         'new_question',         // pushed to seller when a buyer asks a Q
  QUESTION_ANSWERED:    'question_answered',    // pushed to asker when seller answers

  // Best Offer
  OFFER_RECEIVED:       'offer_received',       // pushed to seller when a buyer makes an offer
  OFFER_ACCEPTED:       'offer_accepted',       // pushed to buyer when seller accepts
  OFFER_DECLINED:       'offer_declined',       // pushed to buyer when seller declines
} as const;

export type FirebaseEvent = typeof FIREBASE_EVENTS[keyof typeof FIREBASE_EVENTS];

// ─── User notification inbox contract ─────────────────────────────────────────
//
// Discriminated union for payloads pushed to RTDB_PATHS.userNotifications.
// This is the single source of truth shared by every writer (via
// `pushUserNotification` in firebase-admin.ts) and the NotificationProvider
// consumer. Renaming/omitting a field a consumer reads becomes a COMPILE error
// instead of a silently dropped toast (the `newAmount`→`amount` class of bug).

interface UserNotificationBase {
  auctionId?: string;
  /** epoch ms — the consumer uses this to skip replaying backfilled items */
  timestamp: number;
}

export type UserNotification =
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.OUTBID_ALERT; auctionTitle: string; amount: number })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.NEW_BID; auctionTitle: string; amount: number })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.ENDING_SOON; auctionTitle: string; amount: number; currentPrice: number; endTime?: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.PRICE_ALERT; auctionTitle: string; type: 'TARGET_REACHED' | 'PRICE_DROP'; amount: number; threshold: number; title?: string; message?: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.AUCTION_WON; title: string; auctionTitle?: string; amount: number })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.AUCTION_CLOSED; auctionTitle?: string; message: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.PAYMENT_SUCCESS; message: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.ADVANCE_PAID; auctionTitle?: string; message: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.TRUST_UPDATE; message: string; badges?: string[] })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.CHAT_NOTIFICATION; message: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.NEW_MESSAGE; conversationId: string; senderName?: string; preview?: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.NEW_LISTING; auctionTitle: string; sellerId?: string; coverImage?: string | null })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.NEW_QUESTION; auctionTitle: string; questionId?: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.QUESTION_ANSWERED; auctionTitle?: string | null; questionId?: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.OFFER_RECEIVED; auctionTitle: string; amount: number; buyerName?: string })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.OFFER_ACCEPTED; auctionTitle: string; amount: number })
  | (UserNotificationBase & { event: typeof FIREBASE_EVENTS.OFFER_DECLINED; auctionTitle: string; amount: number })
  | (UserNotificationBase & { event: 'ITEM_SHIPPED'; message: string })
  | (UserNotificationBase & { event: 'badge_earned'; badge?: { label?: string; icon?: string } });
