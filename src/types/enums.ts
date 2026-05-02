export const AuctionStatus = {
  DRAFT:             'DRAFT',
  ACTIVE:            'ACTIVE',
  SOLD:              'SOLD',
  EXPIRED:           'EXPIRED',
  CANCELLED:         'CANCELLED',
  AWAITING_PAYMENT:  'AWAITING_PAYMENT',
  OFFER_PENDING:     'OFFER_PENDING',
} as const;
export type AuctionStatus = typeof AuctionStatus[keyof typeof AuctionStatus];

export const OrderStatus = {
  PENDING:   'PENDING',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
  RECEIVED:  'RECEIVED',
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const EscrowStatus = {
  PENDING:          'PENDING',
  COMMITMENT_PAID:  'COMMITMENT_PAID',
  HELD:             'HELD',
  RELEASED:         'RELEASED',
  REFUNDED:         'REFUNDED',
  DISPUTED:         'DISPUTED',
  FEE_REFUNDED:     'FEE_REFUNDED',
  VERIFICATION_PENDING: 'VERIFICATION_PENDING',
} as const;
export type EscrowStatus = typeof EscrowStatus[keyof typeof EscrowStatus];

export const DisputeStatus = {
  OPEN:             'OPEN',
  RESOLVED_SELLER:  'RESOLVED_SELLER',
  RESOLVED_BUYER:   'RESOLVED_BUYER',
} as const;
export type DisputeStatus = typeof DisputeStatus[keyof typeof DisputeStatus];

export const ReportStatus = {
  PENDING:   'PENDING',
  REVIEWED:  'REVIEWED',
  RESOLVED:  'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;
export type ReportStatus = typeof ReportStatus[keyof typeof ReportStatus];

export const AlertType = {
  PRICE_DROP:               'PRICE_DROP',
  ENDING_SOON:              'ENDING_SOON',
  OUTBID:                   'OUTBID',
  NEW_AUCTION_IN_CATEGORY:  'NEW_AUCTION_IN_CATEGORY',
  TARGET_REACHED:           'TARGET_REACHED',
} as const;
export type AlertType = typeof AlertType[keyof typeof AlertType];
