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
import { getAuth, sendEmailVerification, signInWithCustomToken, type Auth, type User } from 'firebase/auth';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { log } from '@/lib/logger';

const firebaseConfig = {
  apiKey: "AIzaSyAOwypGtSAeCsZpHogZx7Jt_MPX2nh3GZM",
  authDomain: "nilamit.com",
  databaseURL: "https://nilamit-52073-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nilamit-52073",
  storageBucket: "nilamit-52073.firebasestorage.app",
  messagingSenderId: "884637735592",
  appId: "1:884637735592:web:b817a744a54f15a663409d",
  measurementId: "G-H9QW6DLWWJ"
};

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

// Lazy singletons
let _db:      Database        | null = null;
let _storage: FirebaseStorage | null = null;
let _auth:    Auth            | null = null;
let _analytics: Analytics     | null = null;

export async function getClientAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null; // Analytics only works in browser
  if (!_analytics) {
    const supported = await isSupported();
    if (supported) {
      _analytics = getAnalytics(getClientApp());
    }
  }
  return _analytics;
}

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
    try {
      const auth = getClientAuth();

      // Already signed in (e.g., hot-reload)
      if (auth.currentUser) return;

      const res = await fetch('/api/firebase/token');
      if (!res.ok) {
        log.warn('[Firebase Client] Could not get custom token — private RTDB access unavailable.');
        return;
      }
      const { token } = await res.json() as { token: string };
      await signInWithCustomToken(auth, token);

    } catch (err) {
      log.warn('[Firebase Client] Custom token authentication failed. Client auth not fully configured or enabled.', {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  })();

  return _authPromise;
}

// ─── Native Email Verification ────────────────────────────────────────────────

/**
 * Sends a Firebase Auth native verification email to the currently signed-in user.
 *
 * Firebase Auth handles delivery entirely — no Resend, no SMTP, no domain setup required.
 * The email comes from noreply@nilamit-52073.firebaseapp.com (configurable in Firebase Console
 * under Authentication → Templates).
 *
 * Call this client-side after ensureFirebaseAuth() has completed.
 */
export async function sendNativeVerificationEmail(): Promise<void> {
  await ensureFirebaseAuth();
  const auth = getClientAuth();
  const user = auth.currentUser as User | null;

  if (!user) {
    throw new Error('Not signed into Firebase — call ensureFirebaseAuth() first.');
  }
  if (user.emailVerified) {
    return; // Already verified, nothing to do.
  }

  await sendEmailVerification(user);
  log.info('[Firebase Client] Native verification email dispatched via Firebase Auth.');
}
