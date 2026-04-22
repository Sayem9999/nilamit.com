import 'server-only';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]!;
  const projectId   = process.env.FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKeyEnv) {
    console.warn('⚠️ [Firebase Admin] Missing secrets. Using mock app.');
    return initializeApp({ projectId: 'mock-project' }, 'mock-app');
  }
  const privateKey = privateKeyEnv.replace(/\\n/g, '\n');
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL: process.env.FIREBASE_DATABASE_URL ?? `https://${projectId}-default-rtdb.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`,
  });
}

let _db: FirebaseFirestore.Firestore | null = null;

export const db = new Proxy({} as unknown as FirebaseFirestore.Firestore, {
  get(target, prop) {
    if (!_db) {
      _db = getFirestore(getAdminApp());
    }
    return (_db as any)[prop];
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
