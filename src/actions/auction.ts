'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { AuctionService } from '@/services/auction/auction-service';
import { ERROR_CODES } from '@/lib/constants';
import type { AuctionFilters, CreateAuctionInput } from '@/types';

/**
 * Server Action: Fetch auctions with optional filtering
 */
export async function getAuctions(filters: AuctionFilters = {}) {
  try {
    return await AuctionService.list(filters);
  } catch (error) {
    console.error('[Action] getAuctions failed:', error);
    return { auctions: [], total: 0, pages: 0, currentPage: 1 };
  }
}

/**
 * Server Action: Fetch a single auction by ID
 */
export async function getAuction(id: string) {
  try {
    return await AuctionService.getById(id);
  } catch (error) {
    console.error('[Action] getAuction failed:', error);
    return null;
  }
}

/**
 * Server Action: Create a new auction listing
 */
export async function createAuction(input: CreateAuctionInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };

  try {
    // Check seller status
    const userSnap = await db.collection('users').doc(session.user.id).get();
    const userData = userSnap.data();
    
    if (!userData?.isPhoneVerified) return { success: false, error: ERROR_CODES.PHONE_NOT_VERIFIED };
    if (userData?.isBanned) return { success: false, error: 'Your account has been banned for policy violations.' };
    if (userData?.isMinor) return { success: false, error: 'Users under 18 are not eligible to list auctions on Nilamit.' };

    const auction = await AuctionService.create(input, session.user.id);
    
    revalidatePath('/auctions');
    revalidatePath('/');
    
    return { success: true, auctionId: auction.id };
  } catch (error) {
    console.error('[Action] createAuction failed:', error);
    return { success: false, error: 'An unexpected error occurred while creating your auction.' };
  }
}
