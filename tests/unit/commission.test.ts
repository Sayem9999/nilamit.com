import { describe, it, expect } from 'vitest';
import { calculateSuccessFee } from '@/services/finance/commission';

// Money-critical: this determines what the platform earns and what the seller
// nets on every sale. Lock the tier boundaries + custom-rate behaviour.

describe('calculateSuccessFee — tiered rates', () => {
  it('tier 1 (≤ ৳10,000): 2.5% + ৳20', () => {
    expect(calculateSuccessFee(5000)).toEqual({ fee: 145, rate: 0.025 }); // 125 + 20
    expect(calculateSuccessFee(10000)).toEqual({ fee: 270, rate: 0.025 }); // 250 + 20 (boundary inclusive)
  });

  it('tier 2 (৳10,001–৳150,000): 1.5% + ৳20', () => {
    expect(calculateSuccessFee(10001)).toEqual({ fee: 170, rate: 0.015 }); // round(150.015)=150 + 20
    expect(calculateSuccessFee(50000)).toEqual({ fee: 770, rate: 0.015 }); // 750 + 20
    expect(calculateSuccessFee(150000)).toEqual({ fee: 2270, rate: 0.015 }); // 2250 + 20 (boundary inclusive)
  });

  it('tier 3 (> ৳150,000): 1.0% + ৳20', () => {
    expect(calculateSuccessFee(150001)).toEqual({ fee: 1520, rate: 0.01 }); // round(1500.01)=1500 + 20
    expect(calculateSuccessFee(200000)).toEqual({ fee: 2020, rate: 0.01 }); // 2000 + 20
  });
});

describe('calculateSuccessFee — custom flat rate', () => {
  it('overrides tiers and omits the ৳20 flat component', () => {
    expect(calculateSuccessFee(100000, 1.5)).toEqual({ fee: 1500, rate: 0.015 });
    expect(calculateSuccessFee(5000, 5)).toEqual({ fee: 250, rate: 0.05 });
  });

  it('treats a 0% custom rate as a real override (free, not the default tier)', () => {
    expect(calculateSuccessFee(50000, 0)).toEqual({ fee: 0, rate: 0 });
  });

  it('falls back to tiers when custom rate is null/undefined', () => {
    expect(calculateSuccessFee(50000, null)).toEqual({ fee: 770, rate: 0.015 });
    expect(calculateSuccessFee(50000, undefined)).toEqual({ fee: 770, rate: 0.015 });
  });
});
