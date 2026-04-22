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

/** Convert Firestore Timestamps in document data to Dates */
function normalizeDoc<T>(id: string, data: FirebaseFirestore.DocumentData): T {
  const normalized: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) {
      normalized[k] = v.toDate();
    } else {
      normalized[k] = v;
    }
  }
  return normalized as T;
}
