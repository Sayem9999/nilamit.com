import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { isSSLCommerzConfigured, createPaymentSession } from '@/lib/sslcommerz';

describe('sslcommerz (unconfigured / default)', () => {
  it('reports not configured without store creds', () => {
    expect(isSSLCommerzConfigured()).toBe(false);
  });

  it('returns a structured not_configured result instead of throwing', async () => {
    const res = await createPaymentSession({
      tranId: 'feat_abc_7_deadbeef',
      amountBdt: 300,
      productName: 'Featured listing promotion',
      productCategory: 'featured',
      valueA: 'feat_abc_7_deadbeef',
      customer: { name: 'A', email: 'a@b.com', phone: null },
      isPhysical: false,
    });
    expect(res).toEqual({
      ok: false,
      reason: 'not_configured',
      message: expect.any(String),
    });
  });

  it('never throws on a network failure path', async () => {
    // Even unconfigured, the contract is "structured result, never throw".
    await expect(
      createPaymentSession({
        tranId: 't',
        amountBdt: 1,
        productName: 'p',
        productCategory: 'c',
        valueA: 't',
        customer: {},
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe('sslcommerz (configured) — request shaping', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.SSLCOMMERZ_STORE_ID = 'teststore';
    process.env.SSLCOMMERZ_STORE_PASSWORD = 'testpass';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    delete process.env.SSLCOMMERZ_STORE_ID;
    delete process.env.SSLCOMMERZ_STORE_PASSWORD;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns the GatewayPageURL on SUCCESS and posts the expected fields', async () => {
    // Re-import so the module re-reads the now-set env at load time.
    vi.resetModules();
    const { createPaymentSession: create } = await import('@/lib/sslcommerz');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'SUCCESS', GatewayPageURL: 'https://pay.example/redirect', sessionkey: 'k1' }),
    });

    const res = await create({
      tranId: 'feat_xyz_7_nonce',
      amountBdt: 300,
      productName: 'Featured listing promotion',
      productCategory: 'featured',
      valueA: 'feat_xyz_7_nonce',
      customer: { name: 'Seller', email: 's@n.com', phone: '01711111111' },
      isPhysical: false,
    });

    expect(res).toEqual({ ok: true, gatewayUrl: 'https://pay.example/redirect', sessionKey: 'k1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain('tran_id=feat_xyz_7_nonce');
    expect(body).toContain('value_a=feat_xyz_7_nonce');
    expect(body).toContain('total_amount=300');
    expect(body).toContain('currency=BDT');
    expect(body).toContain('product_profile=non-physical-goods');
  });

  it('maps a FAILED gateway response to gateway_error (no throw)', async () => {
    vi.resetModules();
    const { createPaymentSession: create } = await import('@/lib/sslcommerz');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'FAILED', failedreason: 'bad store id' }),
    });

    const res = await create({
      tranId: 't', amountBdt: 1, productName: 'p', productCategory: 'c', valueA: 't', customer: {},
    });
    expect(res).toMatchObject({ ok: false, reason: 'gateway_error' });
  });
});
