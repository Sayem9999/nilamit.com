'use server';

import { z } from 'zod';
import { db, newId, snapDocs, docData } from '@/lib/db';
import { auth } from '@/lib/auth';
import { closeAuctionIfEnded } from '@/lib/auction-logic';
import { filterPII } from '@/lib/pii-filter';
import { ERROR_CODES } from '@/lib/constants';
import type { AuctionFilters, CreateAuctionInput, Auction, AuctionWithSeller, SellerPublic, Bid } from '@/types';

const SELLER_SELECT_FIELDS = ['id','name','email','phone','image','reputationScore','isPhoneVerified','isVerifiedSeller','winningStreak','userLevel'];

async function getSellerPublic(sellerId: string): Promise<SellerPublic> {
  const snap = await db.collection('users').doc(sellerId).get();
  const d = snap.data() ?? {};
  return { 
    id: sellerId, 
    name: d.name ?? null, 
    email: d.email ?? null, 
    phone: d.phone ?? null,
    image: d.image ?? null, 
    reputationScore: d.reputationScore ?? 0,
    isPhoneVerified: d.isPhoneVerified ?? false, 
    emailVerified: d.emailVerified?.toDate?.() ?? null,
    isVerifiedSeller: d.isVerifiedSeller ?? false,
    winningStreak: d.winningStreak ?? 0, 
    userLevel: d.userLevel ?? 1,
    isBanned: d.isBanned ?? false
  };
}

const CreateAuctionSchema = z.object({
  title:           z.string().min(3).max(100),
  description:     z.string().min(10).max(2000),
  images:          z.array(z.string().url()).min(1),
  category:        z.string(),
  startingPrice:   z.number().positive(),
  minBidIncrement: z.number().positive().optional(),
  startTime:       z.string().or(z.date()),
  endTime:         z.string().or(z.date()),
  reservePrice:    z.number().positive().optional(),
  buyItNowPrice:   z.number().positive().optional(),
  location:        z.string().nullable().optional(),
});

export async function createAuction(input: CreateAuctionInput) {
  const v = CreateAuctionSchema.safeParse(input);
  if (!v.success) return { success: false, error: ERROR_CODES.VALIDATION_ERROR };

  const session = await auth();
  if (!session?.user?.id) return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };

  const userSnap = await db.collection('users').doc(session.user.id).get();
  const userData = userSnap.data();
  if (!userData?.isPhoneVerified) return { success: false, error: ERROR_CODES.PHONE_NOT_VERIFIED };
  if (userData?.isMinor) return { success: false, error: 'Users under 18 are not eligible to list auctions on Nilamit.' };

  try {
    const filteredTitle       = filterPII(input.title);
    const filteredDescription = filterPII(input.description);
    const piiDetected         = filteredTitle !== input.title || filteredDescription !== input.description;

    const id  = newId();
    const now = new Date();
    const auction: Auction = {
      id,
      title:           filteredTitle,
      description:     filteredDescription,
      images:          input.images,
      category:        input.category,
      startingPrice:   input.startingPrice,
      currentPrice:    input.startingPrice,
      minBidIncrement: input.minBidIncrement ?? 10,
      startTime:       new Date(input.startTime),
      endTime:         new Date(input.endTime),
      reservePrice:    input.reservePrice ?? null,
      buyItNowPrice:   input.buyItNowPrice ?? null,
      location:        input.location ?? null,
      sellerId:        session.user.id,
      winnerId:        null,
      status:          'ACTIVE',
      isFeatured:      false,
      wasExtended:     false,
      commissionRate:  0,
      commissionEarned: null,
      deliveryCharge:  0,
      deliveryStatus:  'PENDING',
      trackingNumber:  null,
      bidCount:        0,
      createdAt:       now,
      updatedAt:       now,
    };

    await db.collection('auctions').doc(id).set(auction);

    if (piiDetected) {
      const { rtdbPush }         = await import('@/lib/firebase-admin');
      const { RTDB_PATHS, FIREBASE_EVENTS } = await import('@/lib/firebase-events');
      rtdbPush(RTDB_PATHS.userNotifications(session.user.id), {
        event:   FIREBASE_EVENTS.PII_VIOLATION,
        message: 'Your listing was sanitised to remove contact info.',
      }).catch(console.error);
    }

    return { success: true, auction };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create auction.' };
  }
}

export async function getAuction(id: string) {
  await closeAuctionIfEnded(id);

  const [aSnap, escrowSnap, bidsSnap] = await Promise.all([
    db.collection('auctions').doc(id).get(),
    db.collection('escrowTransactions').doc(id).get(),
    db.collection('bids').where('auctionId', '==', id).orderBy('createdAt', 'desc').limit(20).get(),
  ]);

  if (!aSnap.exists) return null;
  const a = aSnap.data()!;

  const [seller, winner] = await Promise.all([
    getSellerPublic(a.sellerId),
    a.winnerId ? db.collection('users').doc(a.winnerId).get() : Promise.resolve(null),
  ]);

  // Bidder profiles
  const bidderIds = [...new Set(bidsSnap.docs.map(d => d.data().bidderId as string))];
  const bidderSnaps = await Promise.all(bidderIds.map(uid => db.collection('users').doc(uid).get()));
  const biddersMap = new Map(bidderSnaps.map(s => [s.id, { id: s.id, name: s.data()?.name ?? null, image: s.data()?.image ?? null }]));

  const bids = bidsSnap.docs.map(d => {
    const b = d.data();
    return { ...b, id: d.id, createdAt: b.createdAt?.toDate?.() ?? new Date(b.createdAt),
      bidder: biddersMap.get(b.bidderId) ?? { id: b.bidderId, name: null, image: null } };
  });

  const escrow = escrowSnap.exists ? (() => {
    const e = escrowSnap.data()!;
    return { ...e, id: escrowSnap.id,
      createdAt: e.createdAt?.toDate?.() ?? new Date(e.createdAt),
      updatedAt: e.updatedAt?.toDate?.() ?? new Date(e.updatedAt),
    };
  })() : null;

  const winnerData = winner?.exists ? { id: winner.id, name: winner.data()?.name ?? null,
    image: winner.data()?.image ?? null, phone: winner.data()?.phone ?? null } : null;

  // Track category view (async, non-blocking)
  if (a.category) {
    import('./recommendations').then(m => m.trackCategoryView(a.category)).catch(() => {});
  }

  return {
    ...a, id,
    startTime:  a.startTime?.toDate?.()  ?? new Date(a.startTime),
    endTime:    a.endTime?.toDate?.()    ?? new Date(a.endTime),
    createdAt:  a.createdAt?.toDate?.()  ?? new Date(a.createdAt),
    updatedAt:  a.updatedAt?.toDate?.()  ?? new Date(a.updatedAt),
    seller,
    bids,
    winner: winnerData,
    escrowTransaction: escrow,
    _count: { bids: bids.length },
  };
}

export async function getAuctions(filters: AuctionFilters = {}) {
  const { status = 'ACTIVE', category, sortBy = 'endTime', sortOrder = 'asc', page = 1, limit = 12 } = filters;

  try {
    let query: FirebaseFirestore.Query = db.collection('auctions');
    if (status)          query = query.where('status', '==', status);
    if (category)        query = query.where('category', '==', category);
    if (filters.location) query = query.where('location', '==', filters.location);

    // Total count for pagination
    const totalSnap = await query.count().get();
    const total = totalSnap.data().count;

    // Sorting and Pagination
    const orderField = sortBy === 'bids' ? 'bidCount' : (sortBy || 'endTime');
    
    // Note: If filters.search is present, Firestore native filtering is limited.
    // For now, we still slice paged results if searching, but optimize the rest.
    let docs: FirebaseFirestore.DocumentSnapshot[] = [];
    
    if (filters.search) {
      // Search still requires a scan because Firestore doesn't support 'contains'
      const allSnap = await query.orderBy(orderField, sortOrder as 'asc' | 'desc').get();
      const q = filters.search.toLowerCase();
      const filteredDocs = allSnap.docs.filter(d => {
        const a = d.data();
        return (a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
      });
      docs = filteredDocs.slice((page - 1) * limit, page * limit);
    } else {
      const pagedSnap = await query
        .orderBy(orderField, sortOrder as 'asc' | 'desc')
        .limit(limit)
        .offset((page - 1) * limit)
        .get();
      docs = pagedSnap.docs;
    }

    const sellerIds = [...new Set(docs.map(d => d.data().sellerId as string))];
    const sellerSnaps = await Promise.all(sellerIds.map(id => db.collection('users').doc(id).get()));
    const sellerMap = new Map(sellerSnaps.map(s => [s.id, s.data() || {}]));

    const auctionsWithSellers: AuctionWithSeller[] = docs.map(d => {
      const a = docData<Auction>(d)!;
      const s = sellerMap.get(a.sellerId) || {};
      return {
        ...a,
        seller: {
          id: a.sellerId,
          name: s.name ?? null,
          email: s.email ?? null,
          phone: s.phone ?? null,
          image: s.image ?? null,
          reputationScore: s.reputationScore ?? 0,
          isPhoneVerified: s.isPhoneVerified ?? false,
          emailVerified: s.emailVerified?.toDate?.() ?? null,
          isVerifiedSeller: s.isVerifiedSeller ?? false,
          winningStreak: s.winningStreak ?? 0,
          userLevel: s.userLevel ?? 1,
          isBanned: s.isBanned ?? false
        },
        _count: { bids: a.bidCount ?? 0 },
      };
    });

    return { auctions: auctionsWithSellers, total, pages: Math.ceil(total / limit), page };
  } catch (e) {
    console.error('[auction] getAuctions failed:', e);
    return { auctions: [], total: 0, pages: 0, page };
  }
}

export async function getMyAuctions() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const snap = await db.collection('auctions')
    .where('sellerId', '==', session.user.id)
    .orderBy('createdAt', 'desc')
    .get();

  return snapDocs<Auction>(snap).map(a => ({
    ...a,
    _count: { bids: a.bidCount ?? 0 },
  }));
}

export async function getSpecializedFeeds() {
  const now  = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const [endingSoonSnap, latestBidsSnap] = await Promise.all([
      db.collection('auctions')
        .where('status', '==', 'ACTIVE')
        .where('endTime', '>=', now)
        .where('endTime', '<=', soon)
        .orderBy('endTime', 'asc')
        .limit(4)
        .get(),
      db.collection('bids')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),
    ]);

    const endingSoon: AuctionWithSeller[] = await Promise.all(snapDocs<Auction>(endingSoonSnap).map(async a => {
      return { 
        ...a,
        seller: await getSellerPublic(a.sellerId),
        _count: { bids: a.bidCount ?? 0 } 
      };
    }));

    const latestBids = await Promise.all(latestBidsSnap.docs.map(async d => {
      const b = docData<Bid>(d)!;
      const [bidderSnap, auctionSnap] = await Promise.all([
        db.collection('users').doc(b.bidderId).get(),
        db.collection('auctions').doc(b.auctionId).get(),
      ]);
      return { 
        ...b,
        bidder: { name: bidderSnap.data()?.name ?? null },
        auction: { id: b.auctionId, title: auctionSnap.data()?.title ?? '' } 
      };
    }));

    return { endingSoon, latestBids };
  } catch (e) {
    console.error('[auction] getSpecializedFeeds failed:', e);
    return { endingSoon: [], latestBids: [] };
  }
}

export async function cancelAuction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated.' };

  const snap = await db.collection('auctions').doc(id).get();
  if (!snap.exists) return { success: false, error: 'Auction not found.' };
  const a = snap.data()!;
  if (a.sellerId !== session.user.id) return { success: false, error: 'Not your auction.' };
  if ((a.bidCount ?? 0) > 0) return { success: false, error: 'Cannot cancel an auction with bids.' };

  await db.collection('auctions').doc(id).update({ status: 'CANCELLED', updatedAt: new Date() });
  return { success: true };
}
