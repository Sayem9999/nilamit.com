import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';

// Mock server-only to avoid boundary issues
vi.mock('server-only', () => ({}));

// We'll mock db.doc(path) to return mock doc references.
const mockDocRef = (path: string) => ({
  path,
  id: path.split('/').pop()!,
  collection: (_name: string) => ({}),
  listCollections: vi.fn().mockResolvedValue([]),
});

// Setup Firestore mocks
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();

const mockBatch = () => ({
  set: mockBatchSet,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
});

vi.mock('@/lib/db', () => {
  return {
    db: {
      listCollections: vi.fn(),
      doc: vi.fn((path) => mockDocRef(path)),
      batch: vi.fn(() => mockBatch()),
    },
  };
});

// Mock logger to prevent spamming test outputs
vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  serializeValue,
  deserializeValue,
  AdminBackupService,
} from '@/services/admin/admin-backup-service';
import { db } from '@/lib/db';

describe('Admin Backup Service — Serialization / Deserialization', () => {
  it('should serialize and deserialize primitive values and arrays', () => {
    const data = {
      name: 'Nilamit App',
      active: true,
      price: 1500,
      tags: ['electronics', 'mobile'],
      meta: null,
    };

    const serialized = serializeValue(data);
    expect(serialized).toEqual(data);

    const deserialized = deserializeValue(serialized);
    expect(deserialized).toEqual(data);
  });

  it('should serialize and deserialize Firestore Timestamps', () => {
    const timestamp = new Timestamp(1715600000, 123000);
    const serialized = serializeValue(timestamp);

    expect(serialized).toEqual({
      __type__: 'timestamp',
      seconds: 1715600000,
      nanoseconds: 123000,
    });

    const deserialized = deserializeValue(serialized);
    expect(deserialized).toBeInstanceOf(Timestamp);
    expect(deserialized.seconds).toBe(1715600000);
    expect(deserialized.nanoseconds).toBe(123000);
  });

  it('should serialize and deserialize JS Dates as Timestamps', () => {
    const date = new Date('2026-05-13T12:00:00.123Z');
    const serialized = serializeValue(date);

    expect(serialized).toEqual({
      __type__: 'timestamp',
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000,
    });

    const deserialized = deserializeValue(serialized);
    expect(deserialized).toBeInstanceOf(Timestamp);
    expect(deserialized.toDate().getTime()).toBe(date.getTime());
  });

  it('should serialize and deserialize GeoPoints', () => {
    const geoPoint = new GeoPoint(23.8103, 90.4125);
    const serialized = serializeValue(geoPoint);

    expect(serialized).toEqual({
      __type__: 'geopoint',
      latitude: 23.8103,
      longitude: 90.4125,
    });

    const deserialized = deserializeValue(serialized);
    expect(deserialized).toBeInstanceOf(GeoPoint);
    expect(deserialized.latitude).toBe(23.8103);
    expect(deserialized.longitude).toBe(90.4125);
  });

  it('should serialize and deserialize DocumentReferences', () => {
    const docRef = mockDocRef('users/sayem123') as unknown as DocumentReference;
    const serialized = serializeValue(docRef);

    expect(serialized).toEqual({
      __type__: 'reference',
      path: 'users/sayem123',
    });

    const deserialized = deserializeValue(serialized);
    // Since db.doc returns our mocked doc reference, check path matches.
    expect(deserialized.path).toBe('users/sayem123');
  });

  it('should handle complex nested structures recursively', () => {
    const complex = {
      user: mockDocRef('users/test') as unknown as DocumentReference,
      timestamp: new Timestamp(1000, 2000),
      nested: {
        points: [new GeoPoint(1, 2), new GeoPoint(3, 4)],
        dates: [new Date(123456789000)],
      },
    };

    const serialized = serializeValue(complex);
    expect(serialized.user.__type__).toBe('reference');
    expect(serialized.timestamp.__type__).toBe('timestamp');
    expect(serialized.nested.points[0].__type__).toBe('geopoint');
    expect(serialized.nested.dates[0].__type__).toBe('timestamp');

    const deserialized = deserializeValue(serialized);
    expect(deserialized.user.path).toBe('users/test');
    expect(deserialized.timestamp).toBeInstanceOf(Timestamp);
    expect(deserialized.nested.points[0]).toBeInstanceOf(GeoPoint);
    expect(deserialized.nested.dates[0]).toBeInstanceOf(Timestamp);
  });
});

describe('Admin Backup Service — Export & Import Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recursively export database collections', async () => {
    // Setup collections and document structures
    const mockUsersDocs = [
      { id: 'u1', ref: mockDocRef('users/u1'), data: () => ({ name: 'User 1' }) },
      { id: 'u2', ref: mockDocRef('users/u2'), data: () => ({ name: 'User 2' }) },
    ];
    const mockAuctionsDocs = [
      {
        id: 'a1',
        ref: {
          ...mockDocRef('auctions/a1'),
          listCollections: async () => [
            {
              get: async () => ({
                docs: [
                  { id: 'b1', ref: mockDocRef('auctions/a1/bids/b1'), data: () => ({ amount: 100 }) }
                ]
              })
            }
          ]
        },
        data: () => ({ title: 'Auction 1' }),
      }
    ];

    const mockCollections = [
      {
        id: 'users',
        get: async () => ({ docs: mockUsersDocs }),
      },
      {
        id: 'auctions',
        get: async () => ({ docs: mockAuctionsDocs }),
      },
    ];

    vi.mocked(db.listCollections).mockResolvedValue(mockCollections as unknown as FirebaseFirestore.CollectionReference[]);

    const backup = await AdminBackupService.exportDatabase();

    expect(db.listCollections).toHaveBeenCalled();
    expect(backup.length).toBe(4); // u1, u2, a1, and nested bid b1
    expect(backup).toContainEqual({ path: 'users/u1', data: { name: 'User 1' } });
    expect(backup).toContainEqual({ path: 'users/u2', data: { name: 'User 2' } });
    expect(backup).toContainEqual({ path: 'auctions/a1', data: { title: 'Auction 1' } });
    expect(backup).toContainEqual({ path: 'auctions/a1/bids/b1', data: { amount: 100 } });
  });

  it('should restore database with batched writes', async () => {
    const entries = Array.from({ length: 600 }, (_, i) => ({
      path: `users/u${i}`,
      data: { name: `User ${i}` },
    }));

    const result = await AdminBackupService.restoreDatabase(entries, false);

    expect(result.successCount).toBe(600);
    // 600 entries should result in 2 batches (500 + 100)
    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledTimes(600);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });

  it('should recursively wipe database collections before restore when wipeFirst is true', async () => {
    const mockUsersDocs = [
      {
        id: 'u1',
        ref: {
          ...mockDocRef('users/u1'),
          listCollections: async () => [
            {
              get: async () => ({
                docs: [
                  { id: 'sub1', ref: mockDocRef('users/u1/sub/sub1') }
                ]
              })
            }
          ]
        }
      }
    ];

    const mockCollections = [
      {
        id: 'users',
        get: async () => ({ docs: mockUsersDocs }),
      },
    ];

    vi.mocked(db.listCollections).mockResolvedValue(mockCollections as unknown as FirebaseFirestore.CollectionReference[]);

    const entries = [{ path: 'users/u1', data: { name: 'New U1' } }];
    const result = await AdminBackupService.restoreDatabase(entries, true);

    expect(result.successCount).toBe(1);
    expect(mockBatchDelete).toHaveBeenCalledTimes(2); // sub1 and u1
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
