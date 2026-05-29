/**
 * Pure proxy-bidding resolution — the heart of the auction money logic.
 *
 * Extracted from BidProcessor's transaction so it can be unit-tested in
 * isolation (no Firestore). Given the current auction state + a new bid, it
 * computes the next displayed price, leader, stored proxy max, and the
 * second-highest tracking used for second-chance offers.
 *
 * eBay-style semantics:
 *  - The first bidder becomes the leader at the starting price; their `amount`
 *    is stored as their hidden max (proxy).
 *  - A new bidder above the current leader's max takes the lead at
 *    min(theirMax, leaderMax + increment); the old leader's max becomes the
 *    second-highest.
 *  - A new bidder at or below the leader's max loses; the leader's displayed
 *    price rises to min(leaderMax, challengerMax + increment) and the
 *    challenger becomes the second-highest.
 *  - The current leader raising their own max only updates the hidden max
 *    (the displayed price doesn't move); a non-raise is rejected.
 *
 * NOTE: this function assumes preconditions (status, min-increment, self-bid,
 * window) have already passed — see validateBidPreconditions.
 */

export interface ProxyBidInput {
  amount: number;
  bidderId: string;
  startingPrice: number;
  currentPrice: number;
  currentBidderId: string | null;
  proxyMaxBid: number | null;
  proxyBidderId: string | null;
  secondHighestBidderId: string | null;
  secondHighestBidAmount: number;
  minBidIncrement: number;
}

export interface ProxyBidState {
  currentPrice: number;
  currentBidderId: string | null;
  proxyMaxBid: number;
  proxyBidderId: string | null;
  secondHighestBidderId: string | null;
  secondHighestBidAmount: number;
}

export type ProxyBidResult =
  | { status: 'OK'; state: ProxyBidState }
  /** The current leader bid at or below their own existing max — no-op. */
  | { status: 'REJECTED_NOT_HIGHER' };

export function resolveProxyBid(input: ProxyBidInput): ProxyBidResult {
  const { amount, bidderId, startingPrice, currentPrice, currentBidderId, minBidIncrement: increment } = input;

  const existingProxy = input.proxyMaxBid || currentPrice || 0;
  const existingProxyBidder = input.proxyBidderId ?? null;

  let newCurrentPrice = currentPrice;
  let newCurrentBidderId = currentBidderId;
  let newProxyMaxBid = input.proxyMaxBid ?? 0;
  let newProxyBidderId = input.proxyBidderId ?? null;
  let newSecondHighestBidderId = input.secondHighestBidderId ?? null;
  let newSecondHighestBidAmount = input.secondHighestBidAmount ?? 0;

  if (!newCurrentBidderId) {
    // First bid on the auction.
    newCurrentPrice = startingPrice;
    newCurrentBidderId = bidderId;
    newProxyMaxBid = amount;
    newProxyBidderId = bidderId;
  } else if (bidderId === existingProxyBidder) {
    // Current leader raising their own hidden max.
    if (amount > existingProxy) {
      newProxyMaxBid = amount;
    } else {
      return { status: 'REJECTED_NOT_HIGHER' };
    }
  } else if (amount > existingProxy) {
    // Challenger outbids the leader's max — challenger takes the lead.
    newSecondHighestBidderId = existingProxyBidder;
    newSecondHighestBidAmount = existingProxy;
    newCurrentPrice = Math.min(amount, existingProxy + increment);
    newCurrentBidderId = bidderId;
    newProxyMaxBid = amount;
    newProxyBidderId = bidderId;
  } else {
    // Challenger at or below the leader's max — leader holds, price ticks up.
    newSecondHighestBidderId = bidderId;
    newSecondHighestBidAmount = amount;
    newCurrentPrice = Math.min(existingProxy, amount + increment);
    newCurrentBidderId = existingProxyBidder;
  }

  return {
    status: 'OK',
    state: {
      currentPrice: newCurrentPrice,
      currentBidderId: newCurrentBidderId,
      proxyMaxBid: newProxyMaxBid,
      proxyBidderId: newProxyBidderId,
      secondHighestBidderId: newSecondHighestBidderId,
      secondHighestBidAmount: newSecondHighestBidAmount,
    },
  };
}
