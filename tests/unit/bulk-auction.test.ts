import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkAuctionService } from '@/services/auction/bulk-auction-service';
import { AuctionService } from '@/services/auction/auction-service';
import { successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { Auction } from '@/types';

// Mock the AuctionService so we don't interact with Firestore/Firebase
vi.mock('@/services/auction/auction-service', () => {
  return {
    AuctionService: {
      create: vi.fn(),
    },
  };
});

describe('BulkAuctionService.createBatch', () => {
  const sellerId = 'test-seller-id';
  const futureTime = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

  const validItem = {
    title: 'Vintage Film Camera',
    description: 'Perfect condition, functional lens.',
    images: ['https://example.com/camera.jpg'],
    category: 'electronics',
    startingPrice: 5000,
    startTime: futureTime(10 * 60 * 1000), // 10 mins future
    endTime: futureTime(24 * 60 * 60 * 1000), // 1 day future
  };

  const invalidItem = {
    title: 'Short', // Invalid schema requirement could be title length or something, but let's just make it invalid by omitting fields
    description: 'No other fields',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('successfully creates all items when they are all valid', async () => {
    vi.mocked(AuctionService.create).mockResolvedValue(successResponse({ id: 'auction-123' } as unknown as Auction));

    const items = [
      { ...validItem, title: 'Camera 1' },
      { ...validItem, title: 'Camera 2' },
      { ...validItem, title: 'Camera 3' },
    ];

    const result = await BulkAuctionService.createBatch(items, sellerId);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.successCount).toBe(3);
      expect(result.data.failureCount).toBe(0);
      expect(result.data.errors).toHaveLength(0);
    }
    expect(AuctionService.create).toHaveBeenCalledTimes(3);
  });

  it('correctly handles items that fail schema validation', async () => {
    vi.mocked(AuctionService.create).mockResolvedValue(successResponse({ id: 'auction-123' } as unknown as Auction));

    const items = [
      { ...validItem, title: 'Camera 1' },
      invalidItem,
      { ...validItem, title: 'Camera 2' },
    ];

    const result = await BulkAuctionService.createBatch(items, sellerId);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.successCount).toBe(2);
      expect(result.data.failureCount).toBe(1);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0].index).toBe(1);
      expect(result.data.errors[0].error).toBe('Validation failed');
    }
    expect(AuctionService.create).toHaveBeenCalledTimes(2);
  });

  it('correctly handles items that fail creation in the AuctionService', async () => {
    vi.mocked(AuctionService.create)
      .mockResolvedValueOnce(successResponse({ id: 'auction-1' } as unknown as Auction))
      .mockResolvedValueOnce(errorResponse(ErrorType.INTERNAL, 'Database insertion failure'))
      .mockResolvedValueOnce(successResponse({ id: 'auction-3' } as unknown as Auction));

    const items = [
      { ...validItem, title: 'Camera 1' },
      { ...validItem, title: 'Camera 2' },
      { ...validItem, title: 'Camera 3' },
    ];

    const result = await BulkAuctionService.createBatch(items, sellerId);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.successCount).toBe(2);
      expect(result.data.failureCount).toBe(1);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0].index).toBe(1);
      expect(result.data.errors[0].error).toBe('Database insertion failure');
    }
    expect(AuctionService.create).toHaveBeenCalledTimes(3);
  });

  it('gracefully handles thrown errors inside creation processing', async () => {
    vi.mocked(AuctionService.create)
      .mockResolvedValueOnce(successResponse({ id: 'auction-1' } as unknown as Auction))
      .mockRejectedValueOnce(new Error('Unexpected network breakdown'))
      .mockResolvedValueOnce(successResponse({ id: 'auction-3' } as unknown as Auction));

    const items = [
      { ...validItem, title: 'Camera 1' },
      { ...validItem, title: 'Camera 2' },
      { ...validItem, title: 'Camera 3' },
    ];

    const result = await BulkAuctionService.createBatch(items, sellerId);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.successCount).toBe(2);
      expect(result.data.failureCount).toBe(1);
      expect(result.data.errors).toHaveLength(1);
      expect(result.data.errors[0].index).toBe(1);
      expect(result.data.errors[0].error).toBe('Internal error');
    }
    expect(AuctionService.create).toHaveBeenCalledTimes(3);
  });
});
