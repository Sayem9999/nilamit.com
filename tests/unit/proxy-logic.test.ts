import { describe, it, expect } from 'vitest';
import { resolveProxyBid, type ProxyBidInput, type ProxyBidState } from '@/services/bidding/proxy-logic';

// Leader "A" holds the auction at displayed price 120 with a hidden max of 200.
const base: ProxyBidInput = {
  amount: 150,
  bidderId: 'B',
  startingPrice: 100,
  currentPrice: 120,
  currentBidderId: 'A',
  proxyMaxBid: 200,
  proxyBidderId: 'A',
  secondHighestBidderId: null,
  secondHighestBidAmount: 0,
  minBidIncrement: 10,
};

function ok(input: ProxyBidInput): ProxyBidState {
  const res = resolveProxyBid(input);
  if (res.status !== 'OK') throw new Error(`expected OK, got ${res.status}`);
  return res.state;
}

describe('resolveProxyBid', () => {
  it('first bid: leader at starting price, amount stored as hidden max', () => {
    const s = ok({
      ...base,
      bidderId: 'X',
      amount: 150,
      currentPrice: 100,
      currentBidderId: null,
      proxyMaxBid: null,
      proxyBidderId: null,
    });
    expect(s.currentPrice).toBe(100); // starting price, not the bid amount
    expect(s.currentBidderId).toBe('X');
    expect(s.proxyMaxBid).toBe(150);
    expect(s.proxyBidderId).toBe('X');
    expect(s.secondHighestBidderId).toBeNull();
  });

  it('leader raising their own max: hidden max updates, displayed price unchanged', () => {
    const s = ok({ ...base, bidderId: 'A', amount: 300 });
    expect(s.proxyMaxBid).toBe(300);
    expect(s.currentBidderId).toBe('A');
    expect(s.currentPrice).toBe(120); // unchanged — no competition
  });

  it('leader bidding at or below their own max is rejected', () => {
    expect(resolveProxyBid({ ...base, bidderId: 'A', amount: 150 }).status).toBe('REJECTED_NOT_HIGHER');
    expect(resolveProxyBid({ ...base, bidderId: 'A', amount: 200 }).status).toBe('REJECTED_NOT_HIGHER');
  });

  it('challenger above leader max takes the lead at leaderMax + increment', () => {
    const s = ok({ ...base, bidderId: 'B', amount: 300 });
    expect(s.currentBidderId).toBe('B');
    expect(s.proxyMaxBid).toBe(300);
    expect(s.currentPrice).toBe(210); // min(300, 200 + 10)
    expect(s.secondHighestBidderId).toBe('A');
    expect(s.secondHighestBidAmount).toBe(200);
  });

  it('challenger capped at their own max when below leaderMax + increment', () => {
    const s = ok({ ...base, bidderId: 'B', amount: 205, minBidIncrement: 10 });
    // min(205, 200 + 10) = 205 — challenger still loses to A's 200? No: 205 > 200 so B leads.
    expect(s.currentBidderId).toBe('B');
    expect(s.currentPrice).toBe(205);
    expect(s.proxyMaxBid).toBe(205);
  });

  it('challenger at or below leader max loses; price ticks up, challenger is second', () => {
    const s = ok({ ...base, bidderId: 'B', amount: 150 });
    expect(s.currentBidderId).toBe('A'); // leader holds
    expect(s.proxyMaxBid).toBe(200); // unchanged
    expect(s.proxyBidderId).toBe('A');
    expect(s.currentPrice).toBe(160); // min(200, 150 + 10)
    expect(s.secondHighestBidderId).toBe('B');
    expect(s.secondHighestBidAmount).toBe(150);
  });

  it('tie at leader max: existing leader wins, price = min(leaderMax, tie + inc)', () => {
    const s = ok({ ...base, bidderId: 'B', amount: 200 });
    expect(s.currentBidderId).toBe('A'); // tie goes to the incumbent
    expect(s.currentPrice).toBe(200); // min(200, 200 + 10)
    expect(s.secondHighestBidderId).toBe('B');
  });

  it('near-cap challenger: price never exceeds leader max', () => {
    const s = ok({ ...base, bidderId: 'B', amount: 198, minBidIncrement: 10 });
    expect(s.currentBidderId).toBe('A');
    expect(s.currentPrice).toBe(200); // min(200, 198 + 10) = 200, capped at leader max
  });
});
