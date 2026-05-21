/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { linkMFSAccount } from '@/actions/user';
import { relistAuction } from '@/actions/auction';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AuctionService } from '@/services/auction/auction-service';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/admin-guard', () => ({
  requireAdmin: vi.fn(),
}));

import { requireAdmin } from '@/lib/admin-guard';
import { adminToggleVerification } from '@/actions/admin/moderation';
import { resolveDispute, adminRefundEscrow } from '@/actions/dispute';
import { updateLogisticsStatus } from '@/actions/logistics';

vi.mock('@/lib/ratelimit', () => ({
  apiLimiter: {
    limit: () => Promise.resolve({ success: true }),
  },
  mfsOtpSendLimiter: {
    limit: () => Promise.resolve({ success: true }),
  },
  mfsOtpVerifyLimiter: {
    limit: () => Promise.resolve({ success: true }),
  },
  emailOtpSendLimiter: {
    limit: () => Promise.resolve({ success: true }),
  },
}));

vi.mock('@/services/auction/auction-service', () => ({
  AuctionService: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => {
  const makeDocRef = (collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`,
    id,
    get: vi.fn().mockImplementation(async () => {
      if (collectionName === 'verificationTokens') {
        return {
          exists: true,
          data: () => ({
            token: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', // hash of '123456'
            expires: { toDate: () => new Date(Date.now() + 5 * 60 * 1000) },
            phone: '+8801712345678',
          }),
        };
      }
      return { exists: false };
    }),
    delete: vi.fn().mockResolvedValue(undefined),
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

describe('linkMFSAccount Security', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await linkMFSAccount('bkash', '01712345678', '123456');
    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/Not authenticated/);
  });

  it('rejects invalid mobile numbers', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
    const res = await linkMFSAccount('bkash', '12345', '123456');
    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/Invalid Bangladeshi mobile number/);
  });

  it('detects and rejects duplicate linked MFS numbers via transaction check', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);

    // Mock db.runTransaction to simulate query finding another user with this number
    vi.mocked(db.runTransaction).mockImplementation(async (callback) => {
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          empty: false,
          docs: [{ id: 'user-2' }],
        }),
        update: vi.fn(),
      } as any;
      return callback(mockTx);
    });

    const res = await linkMFSAccount('bkash', '01712345678', '123456');
    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/This phone number is already linked to another account/);
  });

  it('succeeds and updates profile when the MFS number is unique', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);

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

    const res = await linkMFSAccount('bkash', '01712345678', '123456');
    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('relistAuction Security', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await relistAuction('auction-1');
    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/Not authenticated/);
  });

  it('prevents relisting if auction does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'seller-1' } } as any);

    vi.mocked(db.runTransaction).mockImplementation(async (callback) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref) => {
          if (ref.path && ref.path.startsWith('users/')) {
            return {
              exists: true,
              data: () => ({
                emailVerified: new Date(),
                isBanned: false,
              }),
            };
          }
          return { exists: false };
        }),
      } as any;
      return callback(mockTx);
    });

    const res = await relistAuction('auction-invalid');
    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/Auction not found/);
  });

  it('prevents relisting if the user is not the seller', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'buyer-1' } } as any);

    vi.mocked(db.runTransaction).mockImplementation(async (callback) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref) => {
          if (ref.path && ref.path.startsWith('users/')) {
            return {
              exists: true,
              data: () => ({
                emailVerified: new Date(),
                isBanned: false,
              }),
            };
          }
          return {
            exists: true,
            data: () => ({
              sellerId: 'seller-1',
              status: 'EXPIRED',
              relisted: false,
            }),
          };
        }),
      } as any;
      return callback(mockTx);
    });

    const res = await relistAuction('auction-1');
    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/Only the seller can relist/);
  });

  it('succeeds, marks original as relisted, and creates new auction', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'seller-1' } } as any);
    vi.mocked(AuctionService.create).mockResolvedValue({
      success: true,
      data: { id: 'new-auction-123' },
    } as any);

    const mockUpdate = vi.fn();
    vi.mocked(db.runTransaction).mockImplementation(async (callback) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref) => {
          if (ref.path && ref.path.startsWith('users/')) {
            return {
              exists: true,
              data: () => ({
                emailVerified: new Date(),
                isBanned: false,
              }),
            };
          }
          return {
            exists: true,
            data: () => ({
              sellerId: 'seller-1',
              status: 'EXPIRED',
              relisted: false,
              title: 'Cool Item',
              description: 'Item details',
              category: 'electronics',
              startingPrice: 1000,
              images: ['img1.jpg'],
              startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              endTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
            }),
          };
        }),
        update: mockUpdate,
      } as any;
      return callback(mockTx);
    });

    const res = await relistAuction('auction-1');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ auctionId: 'new-auction-123' });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('Admin Exception Hardening', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('adminToggleVerification returns error response when requireAdmin throws', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Unauthorized: Admin access required.'));
    const res = await adminToggleVerification('user-1', 'Reason');
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe('INTERNAL_ERROR');
    expect(res.error?.message).toBe('Unauthorized: Admin access required.');
  });

  it('resolveDispute returns error response when requireAdmin throws', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Unauthorized: Admin access required.'));
    const res = await resolveDispute('dispute-1', 'SELLER', 'Resolution notes');
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe('INTERNAL_ERROR');
    expect(res.error?.message).toBe('Unauthorized: Admin access required.');
  });

  it('adminRefundEscrow returns error response when requireAdmin throws', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Unauthorized: Admin access required.'));
    const res = await adminRefundEscrow('transaction-1', 'Refund reason');
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe('INTERNAL_ERROR');
    expect(res.error?.message).toBe('Unauthorized: Admin access required.');
  });

  it('updateLogisticsStatus returns error response when requireAdmin throws', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Unauthorized: Admin access required.'));
    const res = await updateLogisticsStatus('auction-1', 'DELIVERED', 'Delivered to recipient');
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe('INTERNAL_ERROR');
    expect(res.error?.message).toBe('Unauthorized: Admin access required.');
  });
});

