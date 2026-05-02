import { db } from '@/lib/db';

export interface AdminEscrowDoc {
  id: string;
  auctionId: string;
  buyerId: string;
  amount: number;
  status: string;
  createdAt: FirebaseFirestore.Timestamp | Date;
  verificationType?: string | null;
  providerRef?: string | null;
}

export type HydratedEscrowRow = {
  id: string; amount: number; status: string; createdAt: Date;
  verificationType: string; providerRef: string | null;
  auction: { id: string; title: string; seller: { name: string | null; phone: string | null } };
  buyer: { name: string | null; email: string | null; phone: string | null };
};

/**
 * Batch-hydrates an array of escrow docs in 3 round-trips (auctions+buyers,
 * then sellers) instead of N×3 serial reads per row.
 */
export async function batchHydrateEscrowRows(txDocs: AdminEscrowDoc[]): Promise<HydratedEscrowRow[]> {
  if (txDocs.length === 0) return [];

  const auctionIds = [...new Set(txDocs.map((t) => t.auctionId))];
  const buyerIds   = [...new Set(txDocs.map((t) => t.buyerId))];

  const [auctionSnaps, buyerSnaps] = await Promise.all([
    db.getAll(...auctionIds.map((id) => db.collection('auctions').doc(id))),
    db.getAll(...buyerIds.map((id) => db.collection('users').doc(id))),
  ]);

  const auctionMap = new Map(auctionSnaps.map((s) => [s.id, s.data() ?? {}]));
  const buyerMap   = new Map(buyerSnaps.map((s) => [s.id, s.data() ?? {}]));

  const sellerIds = [
    ...new Set(
      auctionSnaps
        .map((s) => (s.data() ?? {}).sellerId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const sellerMap = new Map<string, FirebaseFirestore.DocumentData>();
  if (sellerIds.length > 0) {
    const sellerSnaps = await db.getAll(...sellerIds.map((id) => db.collection('users').doc(id)));
    sellerSnaps.forEach((s) => sellerMap.set(s.id, s.data() ?? {}));
  }

  return txDocs.map((tx) => {
    const auction = auctionMap.get(tx.auctionId) ?? {};
    const buyer   = buyerMap.get(tx.buyerId) ?? {};
    const seller  = auction.sellerId ? (sellerMap.get(auction.sellerId as string) ?? {}) : {};

    const createdAtRaw = tx.createdAt as unknown as { toDate?: () => Date } | Date;
    const createdAt = createdAtRaw instanceof Date ? createdAtRaw : createdAtRaw?.toDate?.() ?? new Date();

    return {
      id: tx.id,
      amount: tx.amount,
      status: tx.status,
      createdAt,
      verificationType: tx.verificationType ?? 'AUTOMATIC',
      providerRef: tx.providerRef ?? null,
      auction: {
        id:     tx.auctionId,
        title:  (auction.title  as string | null) ?? 'Unknown Auction',
        seller: { name: (seller.name  as string | null) ?? null, phone: (seller.phone as string | null) ?? null },
      },
      buyer: { name: (buyer.name as string | null) ?? null, email: (buyer.email as string | null) ?? null, phone: (buyer.phone as string | null) ?? null },
    };
  });
}
