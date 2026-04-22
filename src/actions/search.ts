'use server';

import { db, snapDocs, toSellerPublic } from '@/lib/db';
import { Auction } from '@/types';

interface AuctionWithScore extends Auction {
  _score: number;
}

export async function getSmartSearchResults(query: string) {
  if (!query?.trim()) return [];

  const q = query.toLowerCase();

  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .orderBy('endTime', 'asc')
    .limit(200)
    .get();

  const auctions = snapDocs<Auction>(snap);

  const results: AuctionWithScore[] = auctions
    .filter((a) => {
      const title = (a.title ?? '').toLowerCase();
      const desc  = (a.description ?? '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    })
    .map((a) => {
      const titleScore = (a.title ?? '').toLowerCase().includes(q) ? 100 : 0;
      const descScore  = (a.description ?? '').toLowerCase().includes(q) ? 50 : 0;
      const bidScore   = (a.bidCount ?? 0) * 5;
      return { ...a, _score: titleScore + descScore + bidScore };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 20);

  // 1. Batch Fetch Sellers
  const sellerIds = [...new Set(results.map((a) => a.sellerId))];
  const sellerSnaps = await Promise.all(sellerIds.map(id => db.collection('users').doc(id).get()));
  const sellersMap  = new Map(sellerSnaps.map(s => [s.id, s.data()]));

  // 2. Map results to public format
  return results.map((a) => {
    const s = sellersMap.get(a.sellerId);
    return {
      ...a,
      seller: toSellerPublic(a.sellerId, s),
      _count: { bids: a.bidCount ?? 0 },
    };
  });
}

export async function getSearchSuggestions(query: string) {
  if (!query?.trim()) return [];

  const q    = query.toLowerCase();
  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .orderBy('title')
    .limit(100)
    .get();

  return [...new Set(
    snap.docs
      .map(d => d.data().title as string)
      .filter(t => t?.toLowerCase().includes(q))
  )].slice(0, 8);
}
