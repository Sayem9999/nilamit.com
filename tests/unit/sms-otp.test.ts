/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({
    get: () => '127.0.0.1',
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  mfsOtpSendLimiter: {
    limit: vi.fn(() => Promise.resolve({ success: true })),
  },
  mfsOtpVerifyLimiter: {
    limit: vi.fn(() => Promise.resolve({ success: true })),
  },
  emailOtpSendLimiter: {
    limit: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock('@/lib/firebase-email', () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

// Mock Firestore / db
const mockDocSet = vi.fn();
const mockDocGet = vi.fn();
const mockDocDelete = vi.fn();

vi.mock('@/lib/db', () => {
  const makeDocRef = (collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`,
    id,
    set: mockDocSet,
    get: mockDocGet,
    delete: mockDocDelete,
  });

  const mockCollection = (collectionName: string) => {
    const col: any = {
      doc: vi.fn((id) => makeDocRef(collectionName, id || 'mock-id')),
      where: vi.fn(() => col),
      limit: vi.fn(() => col),
      get: vi.fn(),
    };
    return col;
  };

  const mockDb = {
    collection: vi.fn((name) => mockCollection(name)),
    runTransaction: vi.fn(),
  };

  return {
    db: mockDb,
    toSellerPublic: vi.fn(),
    toDate: (val: any) => (val instanceof Date ? val : new Date(val)),
  };
});

// Import modules under test
import { verifyCronSecret } from '@/lib/cron-utils';
import { normalizePhoneForSMS, sendSMS } from '@/lib/sms-gateway';
import { sendMFSVerificationOTP, verifyAndLinkMFSAccount } from '@/actions/otp';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/firebase-email';

describe('Cron Secret Rotation (Multi-Secret)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('authorizes requests matching the new or old secret in CRON_SECRET comma-separated list', () => {
    process.env.CRON_SECRET = 'new_secret_123,old_secret_456';
    process.env.NODE_ENV = 'production';

    const req1 = new Request('https://nilamit.com/api/cron', {
      headers: { authorization: 'Bearer new_secret_123' },
    });
    expect(verifyCronSecret(req1)).toBeNull(); // authorized

    const req2 = new Request('https://nilamit.com/api/cron', {
      headers: { authorization: 'Bearer old_secret_456' },
    });
    expect(verifyCronSecret(req2)).toBeNull(); // authorized

    const req3 = new Request('https://nilamit.com/api/cron', {
      headers: { 'x-cron-secret': 'new_secret_123' },
    });
    expect(verifyCronSecret(req3)).toBeNull(); // authorized

    const req4 = new Request('https://nilamit.com/api/cron', {
      headers: { authorization: 'Bearer wrong_secret' },
    });
    const res4 = verifyCronSecret(req4);
    expect(res4).not.toBeNull();
    expect(res4?.status).toBe(401);
  });
});

describe('SMS Gateway Parser & Sandbox', () => {
  it('normalizes various Bangladeshi phone number formats into 8801XXXXXXXXX form', () => {
    expect(normalizePhoneForSMS('01712345678')).toBe('8801712345678');
    expect(normalizePhoneForSMS('8801912345678')).toBe('8801912345678');
    expect(normalizePhoneForSMS('+8801812345678')).toBe('8801812345678');
    expect(normalizePhoneForSMS('1512345678')).toBe('8801512345678');
  });

  it('runs in Sandbox mode and simulates success when GREENWEB_TOKEN is console or missing', async () => {
    const originalToken = process.env.GREENWEB_TOKEN;
    process.env.GREENWEB_TOKEN = 'console';
    
    const result = await sendSMS('01712345678', 'Hello Sandbox');
    expect(result.success).toBe(true);

    process.env.GREENWEB_TOKEN = originalToken;
  });
});

describe('MFS OTP Creation & Email Fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('generates an OTP, stores hashed token in Firestore, and falls back to Email when SMS gateway fails', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
    
    // Simulate SMS Failure
    const originalToken = process.env.GREENWEB_TOKEN;
    const originalProvider = process.env.SMS_PROVIDER;
    process.env.GREENWEB_TOKEN = 'real_token';
    process.env.SMS_PROVIDER = 'greenweb';

    // Mock fetch to simulate API failure
    const globalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
      text: async () => 'Gateway timeout',
    });

    // Mock User Email query
    vi.mocked(db.collection('users').doc('user-1').get as any).mockResolvedValue({
      exists: true,
      data: () => ({ email: 'test@domain.com' }),
    });

    const res = await sendMFSVerificationOTP('bkash', '01712345678');

    expect(res.success).toBe(true);
    expect(res.data?.fallbackEmail).toBe(true);
    expect(mockDocSet).toHaveBeenCalled(); // writes verificationToken to Firestore
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@domain.com',
      subject: expect.stringContaining('Security OTP Fallback'),
    }));

    // Restore fetch and env
    global.fetch = globalFetch;
    process.env.GREENWEB_TOKEN = originalToken;
    process.env.SMS_PROVIDER = originalProvider;
  });
});

describe('verifyAndLinkMFSAccount logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects incorrect OTPs and accepts correct ones, linking MFS via transaction and deleting token', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);

    // Mock hashed verification token: hash of "123456"
    const crypto = await import('crypto');
    const mockHash = crypto.createHash('sha256').update('123456').digest('hex');

    vi.mocked(mockDocGet).mockResolvedValue({
      exists: true,
      data: () => ({
        token: mockHash,
        expires: { toDate: () => new Date(Date.now() + 5 * 60 * 1000) },
        phone: '+8801712345678',
      }),
    });

    // Mock db.runTransaction
    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();
    vi.mocked(db.runTransaction).mockImplementation(async (callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          empty: true,
          docs: [],
        }),
        update: mockUpdate,
        delete: mockDelete,
      } as any;
      return callback(mockTx);
    });

    // Test wrong OTP
    const resWrong = await verifyAndLinkMFSAccount('bkash', '01712345678', 'wrong');
    expect(resWrong.success).toBe(false);
    expect(resWrong.error?.message).toContain('Incorrect verification code');

    // Test correct OTP
    const resCorrect = await verifyAndLinkMFSAccount('bkash', '01712345678', '123456');
    expect(resCorrect.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });
});
