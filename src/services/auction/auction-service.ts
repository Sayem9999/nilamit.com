import { AuctionReader } from './modules/auction-reader';
import { AuctionWriter } from './modules/auction-writer';
import { AuctionNotifier } from './modules/auction-notifier';
import { Auction, AuctionFilters, AuctionWithSeller, LatestActivity } from '@/types';
import { ServiceResponse } from '@/lib/errors';
import type { CreateAuctionInputValidated } from '@/lib/schemas';

/**
 * AuctionService — Facade for Auction-related business logic.
 * Delegated to specialized modules for scalability.
 */
export class AuctionService {
  static async getById(id: string, viewerId?: string | null): Promise<ServiceResponse<AuctionWithSeller>> {
    return AuctionReader.getById(id, viewerId);
  }

  static async list(filters: AuctionFilters & { limit?: number; lastId?: string; viewerId?: string | null }): Promise<ServiceResponse<{
    auctions: AuctionWithSeller[];
    total: number;
    lastId: string | null;
  }>> {
    return AuctionReader.list(filters);
  }

  static async create(input: CreateAuctionInputValidated, userId: string): Promise<ServiceResponse<Auction>> {
    return AuctionWriter.create(input, userId);
  }

  static async createSecondChanceOffer(auctionId: string): Promise<ServiceResponse<void>> {
    return AuctionWriter.createSecondChanceOffer(auctionId);
  }

  static async getSpecializedFeeds(): Promise<ServiceResponse<{ 
    endingSoon: AuctionWithSeller[], 
    latestBids: LatestActivity[] 
  }>> {
    return AuctionReader.getSpecializedFeeds();
  }

  static async notifyFollowersOfNewListing(
    auctionId: string,
    sellerId: string,
    title: string,
    coverImage: string | undefined
  ): Promise<void> {
    return AuctionNotifier.notifyFollowersOfNewListing(auctionId, sellerId, title, coverImage);
  }
}
