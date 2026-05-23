import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

// Mock server-only to avoid boundary issues
vi.mock('server-only', () => ({}));

// Setup Firestore mocks
const mockBatchSet = vi.fn();
const mockBatch = () => ({
  set: mockBatchSet,
});

const mockTxSet = vi.fn();
const mockTransaction = () => ({
  set: mockTxSet,
});

const mockLogRef = (id: string) => ({
  id,
  set: vi.fn().mockResolvedValue(undefined),
});

const mockDocRef = (id: string) => ({
  id,
  collection: vi.fn(() => ({
    doc: vi.fn(() => mockLogRef('mock-log-id')),
  })),
});

vi.mock('@/lib/db', () => {
  return {
    db: {
      collection: vi.fn(() => ({
        doc: vi.fn((id) => mockDocRef(id)),
      })),
      doc: vi.fn((path) => ({ path, id: path.split('/').pop()! })),
      batch: vi.fn(() => mockBatch()),
    },
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock auth session
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-admin-id' } }),
}));

import {
  getDiff,
  serializeForAudit,
  AuditService,
} from '@/services/admin/audit-service';
import { db } from '@/lib/db';

describe('Audit Service — Diffing & Serialization', () => {
  it('should detect differences between before and after states', () => {
    const before = {
      title: 'Old Title',
      price: 100,
      tags: ['a', 'b'],
    };
    const after = {
      title: 'New Title',
      price: 100, // unchanged
      tags: ['a', 'c'], // modified array
    };

    const diff = getDiff(before, after);
    expect(diff.title).toEqual({ before: 'Old Title', after: 'New Title' });
    expect(diff.tags).toEqual({ before: ['a', 'b'], after: ['a', 'c'] });
    expect(diff.price).toBeUndefined(); // no diff
  });

  it('should handle creation diff (before is null)', () => {
    const after = { title: 'New Item', price: 50 };
    const diff = getDiff(null, after);
    expect(diff.title).toEqual({ before: null, after: 'New Item' });
    expect(diff.price).toEqual({ before: null, after: 50 });
  });

  it('should handle deletion diff (after is null)', () => {
    const before = { title: 'Deleted Item' };
    const diff = getDiff(before, null);
    expect(diff.title).toEqual({ before: 'Deleted Item', after: null });
  });

  it('should serialize Date objects to Firestore Timestamps', () => {
    const date = new Date('2026-05-23T12:00:00Z');
    const serialized = serializeForAudit(date);
    expect(serialized).toBeInstanceOf(Timestamp);
  });

  it('should clone nested objects and serialize dates within them', () => {
    const input = {
      name: 'Test',
      meta: {
        updatedAt: new Date('2026-05-23T12:00:00Z'),
      },
    };
    const serialized = serializeForAudit(input) as {
      name: string;
      meta: {
        updatedAt: Timestamp;
      };
    };
    expect(serialized.name).toBe('Test');
    expect(serialized.meta.updatedAt).toBeInstanceOf(Timestamp);
  });
});

describe('Audit Service — Firestore Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write an update log directly to the document history subcollection', async () => {
    const before = { status: 'ACTIVE' };
    const after = { status: 'CANCELLED' };

    await AuditService.logAuctionChange('auction-123', before, after, 'UPDATE', 'operator-999');

    const mockCollectionCall = vi.mocked(db.collection);
    expect(mockCollectionCall).toHaveBeenCalledWith('auctions');
  });

  it('should perform write using transaction context when provided', async () => {
    const before = { status: 'ACTIVE' };
    const after = { status: 'CANCELLED' };
    const tx = mockTransaction() as unknown as FirebaseFirestore.Transaction;

    await AuditService.logAuctionChange('auction-123', before, after, 'UPDATE', 'operator-999', tx);

    expect(mockTxSet).toHaveBeenCalled();
  });

  it('should perform write using batch context when provided', async () => {
    const before = { status: 'HELD' };
    const after = { status: 'RELEASED' };
    const batch = mockBatch() as unknown as FirebaseFirestore.WriteBatch;

    await AuditService.logEscrowChange('escrow-123', before, after, 'UPDATE', 'operator-999', batch);

    expect(mockBatchSet).toHaveBeenCalled();
  });
});
