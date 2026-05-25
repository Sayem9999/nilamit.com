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
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { log } from '@/lib/logger';

const firebaseConfig = {
  apiKey:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAOwypGtSAeCsZpHogZx7Jt_MPX2nh3GZM",
  authDomain:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "nilamit-52073.firebaseapp.com",
  databaseURL:        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://nilamit-52073-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nilamit-52073",
  storageBucket:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "nilamit-52073.firebasestorage.app",
  messagingSenderId:  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "884637735592",
  appId:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:884637735592:web:b817a744a54f15a663409d",
  measurementId:      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-H9QW6DLWWJ"
};

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  
  const app = initializeApp(firebaseConfig);
  
  // Initialize App Check (reCAPTCHA v3) if in browser
  /*
  if (typeof window !== 'undefined') {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    const isDev = process.env.NODE_ENV === 'development';
    
    if (siteKey || isDev) {
      try {
        if (isDev) {
          // Enable debug token in development environment
          const win = window as typeof window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string };
          win.FIREBASE_APPCHECK_DEBUG_TOKEN = 
            process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
        }
        
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey || '6Leg4fUsAAAAAIITIGqtUG5pzOqB5WX7F3tbD5be'),
          isTokenAutoRefreshEnabled: true
        });
      } catch (err) {
        log.warn('[Firebase Client] App Check initialization failed', { error: err });
      }
    }
  }
  */
  
  return app;
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
  if (!_db) {
    const app = getClientApp();
    const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 
                "https://nilamit-52073-default-rtdb.asia-southeast1.firebasedatabase.app";
    _db = getDatabase(app, url);
  }
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const auth = getClientAuth();

      // Already signed in (e.g., hot-reload)
      if (auth.currentUser) return;

      const res = await fetch('/api/firebase/token', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        log.warn('[Firebase Client] Could not get custom token — private RTDB access unavailable.');
        return;
      }
      const { token } = await res.json() as { token: string };
      await signInWithCustomToken(auth, token);

    } catch (err) {
      clearTimeout(timeoutId);
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
