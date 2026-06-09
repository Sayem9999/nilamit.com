import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import {
  mapCourierStatus,
  isCourierConfigured,
  bookShipment,
  isCourierWebhookSecretValid,
} from '@/lib/courier';

describe('mapCourierStatus', () => {
  it('maps known courier statuses to LogisticsStatus', () => {
    expect(mapCourierStatus('pending')).toBe('READY_FOR_PICKUP');
    expect(mapCourierStatus('picked_up')).toBe('PICKED_UP');
    expect(mapCourierStatus('in_transit')).toBe('IN_TRANSIT');
    expect(mapCourierStatus('out_for_delivery')).toBe('OUT_FOR_DELIVERY');
    expect(mapCourierStatus('delivered')).toBe('DELIVERED');
    expect(mapCourierStatus('cancelled')).toBe('FAILED');
    expect(mapCourierStatus('returned')).toBe('FAILED');
  });

  it('is case-insensitive and falls back to IN_TRANSIT for unknowns', () => {
    expect(mapCourierStatus('DELIVERED')).toBe('DELIVERED');
    expect(mapCourierStatus('something_new')).toBe('IN_TRANSIT');
    expect(mapCourierStatus('')).toBe('IN_TRANSIT');
    expect(mapCourierStatus(null)).toBe('IN_TRANSIT');
  });
});

describe('courier (unconfigured / default)', () => {
  it('reports not configured without creds', () => {
    expect(isCourierConfigured()).toBe(false);
  });

  it('bookShipment returns null (caller falls back to internal tracking)', async () => {
    const res = await bookShipment({
      invoice: 'NLM-1', recipientName: 'A', recipientPhone: '0171', recipientAddress: 'Dhaka', codAmount: 100,
    });
    expect(res).toBeNull();
  });

  it('rejects webhook calls when no secret is set', () => {
    expect(isCourierWebhookSecretValid('anything')).toBe(false);
    expect(isCourierWebhookSecretValid(null)).toBe(false);
  });
});

describe('courier webhook secret', () => {
  beforeEach(() => { process.env.COURIER_WEBHOOK_SECRET = 'topsecret'; });
  afterEach(() => { delete process.env.COURIER_WEBHOOK_SECRET; });

  it('accepts the exact secret, rejects others', () => {
    expect(isCourierWebhookSecretValid('topsecret')).toBe(true);
    expect(isCourierWebhookSecretValid('wrong')).toBe(false);
    expect(isCourierWebhookSecretValid(undefined)).toBe(false);
  });
});
