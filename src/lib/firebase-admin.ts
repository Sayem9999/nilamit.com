/**
 * firebase-admin.ts — Firebase Admin SDK (server-side only)
 *
 * Used for:
 *   - Realtime Database writes  (replacing Pusher server triggers)
 *   - Firebase Storage uploads  (replacing UploadThing)
 *   - Custom auth tokens        (so clients can auth with RTDB/Storage)
 *   - Firestore writes          (email queue for Trigger Email extension)
 *
 * NEVER import this in client components — it uses Node.js APIs.
 * Add 'server-only' import in any file that uses this.
 */

import 'server-only';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/** Single source of truth for Firebase Admin initialization */
export function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0]!;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      '[Firebase Admin] Missing required credentials. ' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
  }

  // Robust private key parsing: handles literal newlines, escaped \n, 
  // and potential JSON-stringified wrappers from secret managers.
  let privateKey = privateKeyRaw.trim();
  
  // Handle escaped quotes from environment variables
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  // Handle escaped newlines
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Ensure key is wrapped correctly if it was stripped or partially formatted
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    // If it's a single line of base64 data, wrap it
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  } else if (!privateKey.includes('\n') && privateKey.length > 100) {
    // If it has headers but no newlines, it's likely a single line that needs formatting
    const body = privateKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    
    // Chunk the base64 body into 64-char lines as per PEM spec
    const chunks = body.match(/.{1,64}/g) || [];
    privateKey = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----`;
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL: process.env.FIREBASE_DATABASE_URL ??
      `https://${projectId}-default-rtdb.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ??
      `${projectId}.firebasestorage.app`,
  });
}

// Lazy singletons — safe for Cloud Run (persistent process)
let _db:        Database  | null = null;
let _storage:   Storage   | null = null;
let _auth:      Auth      | null = null;
let _firestore: Firestore | null = null;

export const adminDB = {
  get instance(): Database {
    if (!_db) _db = getDatabase(getAdminApp());
    return _db;
  },
  ref(path: string) { return this.instance.ref(path); },
};

export const adminStorage = {
  get instance(): Storage {
    if (!_storage) _storage = getStorage(getAdminApp());
    return _storage;
  },
  bucket() { return this.instance.bucket(); },
};

export const adminAuth = {
  get instance(): Auth {
    if (!_auth) _auth = getAuth(getAdminApp());
    return _auth;
  },
  createCustomToken(uid: string, claims?: Record<string, unknown>) {
    return this.instance.createCustomToken(uid, claims);
  },
};

export const adminFirestore = {
  get instance(): Firestore {
    if (!_firestore) _firestore = getFirestore(getAdminApp());
    return _firestore;
  },
  collection(name: string) { return this.instance.collection(name); },
};

// ─── Helper: write a real-time event ─────────────────────────────────────────
/**
 * Push a real-time event to a Firebase RTDB path.
 * Equivalent to pusherServer.trigger(channel, event, data).
 *
 * The data is pushed as a new child (auto-keyed by timestamp).
 * Clients listen with onChildAdded() to receive events in order.
 */
export async function rtdbPush(path: string, data: Record<string, unknown>): Promise<void> {
  await adminDB.ref(path).push({
    ...data,
    _ts: Date.now(),
  });
}

/**
 * Set (overwrite) a value at a path — use for "current state" nodes
 * like the latest bid price on an auction.
 */
export async function rtdbSet(path: string, data: Record<string, unknown>): Promise<void> {
  await adminDB.ref(path).set({
    ...data,
    _ts: Date.now(),
  });
}
