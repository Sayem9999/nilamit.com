/**
 * firebase-client.ts — Firebase JS SDK (browser/client-side only)
 *
 * Replaces pusher-client.ts.
 * Provides the Realtime Database, Storage, and Auth instances for client components.
 *
 * Authentication flow:
 *   1. User is already signed in via NextAuth (server-side session).
 *   2. Call `getFirebaseToken()` once per session — it hits /api/firebase/token
 *      which uses the Admin SDK to mint a custom Firebase token.
 *   3. Call `signInWithCustomToken(clientAuth, token)` — Firebase client is now
 *      authenticated and can access RTDB/Storage paths guarded by security rules.
 *
 * This file is safe to import in client components (no Node.js APIs).
 */

'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, signInWithCustomToken, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
    `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

// Lazy singletons
let _db:      Database        | null = null;
let _storage: FirebaseStorage | null = null;
let _auth:    Auth            | null = null;

export function getClientDB(): Database {
  if (!_db) _db = getDatabase(getClientApp());
  return _db;
}

export function getClientStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getClientApp());
  return _storage;
}

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(getClientApp());
  return _auth;
}

// ─── Custom Token Auth ────────────────────────────────────────────────────────
let _authPromise: Promise<void> | null = null;

/**
 * Authenticate the Firebase client using a custom token minted by the server.
 * Safe to call multiple times — result is cached per page load.
 * Must be called before accessing any private RTDB paths or Storage paths.
 */
export async function ensureFirebaseAuth(): Promise<void> {
  if (_authPromise) return _authPromise;

  _authPromise = (async () => {
    const auth = getClientAuth();

    // Already signed in (e.g., hot-reload)
    if (auth.currentUser) return;

    const res = await fetch('/api/firebase/token');
    if (!res.ok) {
      console.warn('[Firebase Client] Could not get custom token — private RTDB access unavailable.');
      return;
    }
    const { token } = await res.json() as { token: string };
    await signInWithCustomToken(auth, token);
  })();

  return _authPromise;
}
