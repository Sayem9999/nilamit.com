import { ERROR_CODES, SOFT_CLOSE_WINDOW_MS, SOFT_CLOSE_EXTENSION_MS } from '@/lib/constants';

export interface ValidateBidPreconditionsInput {
  auctionStatus: string;
  endTime: Date;
  sellerId: string;
  bidderId: string;
  currentPrice: number | undefined;
  startingPrice: number;
  minBidIncrement: number | undefined;
  amount: number;
  now: Date;
  startTime?: Date | string;
}

export function validateBidPreconditions(input: ValidateBidPreconditionsInput): { minRequired: number } {
  const { auctionStatus, endTime, sellerId, bidderId, currentPrice, startingPrice, minBidIncrement, amount, now } = input;

  if (auctionStatus !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
  if (now < new Date(input.startTime || 0)) throw new Error('AUCTION_NOT_STARTED');
  if (now >= endTime) throw new Error(ERROR_CODES.AUCTION_ENDED);
  if (sellerId === bidderId) throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);

  const minRequired = (currentPrice ?? startingPrice) + (minBidIncrement ?? 10);
  if (amount < minRequired) {
    throw new Error(`${ERROR_CODES.BID_TOO_LOW}: ৳${minRequired.toLocaleString()}`);
  }

  return { minRequired };
}

export function computeAntiSnipeExtension(input: { endTime: Date; now: Date }): { newEndTime: Date; triggered: boolean } {
  const { endTime, now } = input;
  const timeUntilEnd = endTime.getTime() - now.getTime();

  if (timeUntilEnd <= SOFT_CLOSE_WINDOW_MS) {
    return {
      newEndTime: new Date(endTime.getTime() + SOFT_CLOSE_EXTENSION_MS),
      triggered: true,
    };
  }

  return { newEndTime: endTime, triggered: false };
}
