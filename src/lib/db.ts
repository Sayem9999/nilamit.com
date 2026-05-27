import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from './firebase-admin';

export const db = new Proxy({} as unknown as FirebaseFirestore.Firestore, {
  get(target, prop) {
    const val = Reflect.get(adminFirestore.instance, prop);
    return typeof val === 'function' ? val.bind(adminFirestore.instance) : val;
  }
});
export { FieldValue, Timestamp };

/** Convert Firestore Timestamp (or raw value) to a JS Date */
export function toDate(ts: FirebaseFirestore.Timestamp | Date | string | null | undefined): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts as string);
}

/** Generate a new Firestore-style unique ID without writing anything */
export function newId(): string {
  return db.collection('_').doc().id;
}

import { SellerPublic, Message } from '@/types';

/** Map a raw User document to the SellerPublic interface (No PII) */
export function toSellerPublic(id: string, data: unknown): SellerPublic | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  
  return {
    id,
    name: (d.name as string) ?? null,
    image: (d.image as string) ?? null,
    rating: (d.rating as number) ?? 0,
    ratingCount: (d.ratingCount as number) ?? 0,
    reputationScore: (d.reputationScore as number) ?? 0,
    emailVerified: d.emailVerified instanceof Timestamp ? d.emailVerified.toDate() : (d.emailVerified ? new Date(d.emailVerified as string) : null),
    isVerifiedSeller: !!d.isVerifiedSeller,
    isRetailer: !!d.isRetailer,
    isTopRated: !!d.isTopRated,
    winningStreak: (d.winningStreak as number) ?? 0,
    userLevel: (d.userLevel as number) ?? 1,
    salesCount: (d.salesCount as number) ?? 0,
    defectCount: (d.defectCount as number) ?? 0,
    isBanned: !!d.isBanned,
    bio: (d.bio as string) ?? null,
    banner: (d.banner as string) ?? null,
  };
}

/** Map a raw User document to the full Seller info (PII Sanitized - Email only) */
export function toSellerPrivate(id: string, data: unknown): SellerPublic | null {
  return toSellerPublic(id, data);
}

/** Map a raw Message document to the Message interface */
export function toMessage(id: string, data: unknown): Message {
  const d = data as Record<string, unknown>;
  const createdAt = d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt ? new Date(d.createdAt as string) : new Date());
  
  return {
    id,
    conversationId: (d.conversationId as string) ?? '',
    content: (d.content as string) ?? '',
    senderId: (d.senderId as string) ?? '',
    imageUrl: (d.imageUrl as string) ?? null,
    isSystemMessage: !!d.isSystemMessage,
    isRead: !!d.isRead,
    createdAt
  };
}

/** Safely unwrap a DocumentSnapshot into typed data */
export function docData<T>(doc: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!doc.exists) return null;
  const data = doc.data()!;
  return normalizeDoc<T>(doc.id, data);
}

/** Map a QuerySnapshot to typed array */
export function snapDocs<T>(snap: FirebaseFirestore.QuerySnapshot): T[] {
  return snap.docs.map(d => normalizeDoc<T>(d.id, d.data()));
}

/** Helper to recursively normalize values (e.g. nested Firestore timestamps) */
function normalizeValue(v: unknown): unknown {
  if (v && typeof v === 'object') {
    if ('toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
      return (v as { toDate: () => unknown }).toDate();
    }
    if ('_seconds' in v && typeof (v as { _seconds: unknown })._seconds === 'number') {
      return new Date((v as { _seconds: number })._seconds * 1000);
    }
    if (Array.isArray(v)) {
      return v.map(normalizeValue);
    }
    if (v instanceof Date) {
      return v;
    }
    // Only traverse plain objects
    const proto = Object.getPrototypeOf(v);
    if (proto === null || proto === Object.prototype) {
      const copy: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
        copy[key] = normalizeValue(val);
      }
      return copy;
    }
  }
  return v;
}

/** Convert Firestore Timestamps in document data to Dates and ensure stable defaults */
function normalizeDoc<T>(id: string, data: FirebaseFirestore.DocumentData): T {
  const normalized: Record<string, unknown> = { id };
  
  for (const [k, v] of Object.entries(data)) {
    normalized[k] = normalizeValue(v);
  }

  // Ensure critical fields are never undefined for consistent UI rendering
  if (normalized.bidCount === undefined) normalized.bidCount = 0;
  if (normalized.currentPrice === undefined && normalized.startingPrice !== undefined) {
    normalized.currentPrice = normalized.startingPrice;
  }

  return normalized as T;
}

/** Increment a global platform statistic atomically (O(1) cost/latency vs count()) */
export async function incrementGlobalStat(field: 'totalUsers' | 'totalBids' | 'totalAuctions' | 'totalVerifiedSellers' | 'totalRevenue', amount = 1) {
  try {
    // ─── HIGH TRAFFIC SHARDING ──────────────────────────────────────────────
    // For 'totalBids', we use a distributed counter pattern (10 shards) to
    // bypass the Firestore limit of ~1 write/sec per document.
    if (field === 'totalBids') {
      const numShards = 10;
      const shardId = Math.floor(Math.random() * numShards).toString();
      const shardRef = db.collection('stats').doc('global').collection('shards').doc(shardId);
      
      await shardRef.set({
        count: FieldValue.increment(amount),
        updatedAt: Timestamp.now()
      }, { merge: true });

      // We still update the 'updatedAt' on the main doc periodically or on each write
      // (The main doc write cost is fine if we only update the timestamp)
      await db.collection('stats').doc('global').set({
        updatedAt: Timestamp.now()
      }, { merge: true });
      return;
    }

    // ─── STANDARD INCREMENT ────────────────────────────────────────────────
    await db.collection('stats').doc('global').set({
      [field]: FieldValue.increment(amount),
      updatedAt: Timestamp.now()
    }, { merge: true });
  } catch (e) {
    console.error(`[db] Failed to increment global stat ${field}`, e);
  }
}

/**
 * Delete a large collection/query by batching operations (avoids the 500-limit error).
 */
export async function batchDelete(query: FirebaseFirestore.Query) {
  const snapshot = await query.get();
  if (snapshot.empty) return;

  const chunks = [];
  for (let i = 0; i < snapshot.docs.length; i += 500) {
    chunks.push(snapshot.docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}
