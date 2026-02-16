'use server';

import { prisma } from '@/lib/db';
import { Resend } from 'resend';
import { auth } from '@/lib/auth';
import type { AuctionFilters, CreateAuctionInput } from '@/types';
import { closeAuctionIfEnded, closeAllEndedAuctions } from '@/lib/auction-logic';
import { AuctionStatus } from '@prisma/client';

/**
 * Create a new auction (requires phone verification)
 */
export async function createAuction(input: CreateAuctionInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be logged in.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPhoneVerified: true },
  });

  if (!user?.isPhoneVerified) {
    return { success: false, error: 'PHONE_NOT_VERIFIED' };
  }

  try {
    const auction = await prisma.auction.create({
      data: {
        title: input.title,
        description: input.description,
        images: input.images,
        category: input.category,
        startingPrice: input.startingPrice,
        currentPrice: input.startingPrice,
        minBidIncrement: input.minBidIncrement || 10,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        location: input.location,
        sellerId: session.user.id,
        status: 'ACTIVE' as any,
      },
    });

    return { success: true, auction };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create auction.' };
  }
}

/**
 * Get a single auction with seller info and bids
 */
export async function getAuction(id: string) {
  // Passive check: Ensure the auction is closed if time is up
  await closeAuctionIfEnded(id);
  
  return prisma.auction.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, name: true, image: true, reputationScore: true, isPhoneVerified: true } },
      bids: {
        include: { bidder: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      winner: { select: { id: true, name: true, image: true } },
      _count: { select: { bids: true } },
    },
  });
}

/**
 * Get auctions with filters, search, sort, and pagination
 */
export async function getAuctions(filters: AuctionFilters = {}) {
  const {
    status = 'ACTIVE',
    category,
    search,
    sortBy = 'endTime',
    sortOrder = 'asc',
    page = 1,
    limit = 12,
  } = filters;

  // Proactive check: On browse, occasionally sweep for ended auctions
  // This helps keep the "Active" list fresh
  if (Math.random() > 0.8) { 
    closeAllEndedAuctions().catch(console.error);
  }

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (filters.location) where.location = filters.location;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Record<string, string> = {};
  if (sortBy === 'bids') {
    // Sort by bid count handled separately
  } else {
    orderBy[sortBy] = sortOrder;
  }

  const [auctions, total] = await Promise.all([
    prisma.auction.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, image: true, reputationScore: true, isPhoneVerified: true } },
        _count: { select: { bids: true } },
      },
      orderBy: sortBy === 'bids' ? { bids: { _count: sortOrder } } : orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auction.count({ where }),
  ]);

  return {
    auctions,
    total,
    pages: Math.ceil(total / limit),
    page,
  };
}

/**
 * Get auctions by the current user (as seller)
 */
export async function getMyAuctions() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.auction.findMany({
    where: { sellerId: session.user.id },
    include: { _count: { select: { bids: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get specialized feeds for the home page (Ending Soon, etc.)
 */
export async function getSpecializedFeeds() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours

  const [endingSoon, latestBids] = await Promise.all([
    prisma.auction.findMany({
      where: {
        status: 'ACTIVE' as any,
        endTime: { gte: now, lte: soon },
      },
      include: {
        seller: { select: { name: true, image: true, isVerifiedSeller: true } },
        _count: { select: { bids: true } },
      },
      orderBy: { endTime: 'asc' },
      take: 4,
    }),
    prisma.bid.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        bidder: { select: { name: true } },
        auction: { select: { title: true, id: true } },
      },
    }),
  ]);

  return { endingSoon, latestBids };
}

/**
 * Cancel an auction (only seller, only if no bids)
 */
export async function cancelAuction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { _count: { select: { bids: true } } },
  });

  if (!auction) return { success: false, error: 'Auction not found.' };
  if (auction.sellerId !== session.user.id) return { success: false, error: 'Not your auction.' };
  if (auction._count.bids > 0) return { success: false, error: 'Cannot cancel auction with existing bids.' };

  await prisma.auction.update({
    where: { id },
    data: { status: 'CANCELLED' as any },
  });

  return { success: true };
}
