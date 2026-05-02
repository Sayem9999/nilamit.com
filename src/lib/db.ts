import 'server-only';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminApp } from './firebase-admin';

let _db: FirebaseFirestore.Firestore | null = null;

export const db = new Proxy({} as unknown as FirebaseFirestore.Firestore, {
  get(target, prop) {
    if (!_db) {
      _db = getFirestore(getAdminApp());
    }
    return Reflect.get(_db, prop);
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
    email: (d.email as string) ?? null,
    image: (d.image as string) ?? null,
    rating: (d.rating as number) ?? 0,
    ratingCount: (d.ratingCount as number) ?? 0,
    isPhoneVerified: !!d.isPhoneVerified,
    emailVerified: d.emailVerified instanceof Timestamp ? d.emailVerified.toDate() : (d.emailVerified ? new Date(d.emailVerified as string) : null),
    isVerifiedSeller: !!d.isVerifiedSeller,
    isRetailer: !!d.isRetailer,
    isTopRated: !!d.isTopRated,
    winningStreak: (d.winningStreak as number) ?? 0,
    userLevel: (d.userLevel as number) ?? 1,
    salesCount: (d.salesCount as number) ?? 0,
    defectCount: (d.defectCount as number) ?? 0,
    isBanned: !!d.isBanned
  };
}

/** Map a raw User document to the full Seller info (Including PII) */
export function toSellerPrivate(id: string, data: unknown): (SellerPublic & { phone: string | null }) | null {
  const publicData = toSellerPublic(id, data);
  if (!publicData) return null;
  const d = data as Record<string, unknown>;
  return {
    ...publicData,
    phone: (d.phone as string) ?? null
  };
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

/** Convert Firestore Timestamps in document data to Dates and ensure stable defaults */
function normalizeDoc<T>(id: string, data: FirebaseFirestore.DocumentData): T {
  const normalized: Record<string, unknown> = { id };
  
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) {
      normalized[k] = v.toDate();
    } else {
      normalized[k] = v;
    }
  }

  // Ensure critical fields are never undefined for consistent UI rendering
  if (normalized.bidCount === undefined) normalized.bidCount = 0;
  if (normalized.currentPrice === undefined && normalized.startingPrice !== undefined) {
    normalized.currentPrice = normalized.startingPrice;
  }

  return normalized as T;
}
