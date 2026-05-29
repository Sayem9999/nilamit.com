'use client';

/**
 * fcm.ts — Browser FCM client.
 *
 * Server-side delivery (fcm-sender.ts → pushToUser) reads users/{uid}.fcmTokens
 * and is already wired into bid/seller notifications. But nothing ever populated
 * fcmTokens because the browser opt-in/registration was missing — so background
 * push never delivered. This module supplies the missing piece:
 *
 *   - enablePushNotifications()   → request permission + register a token (call
 *                                   from a user gesture, e.g. a "Enable alerts" button)
 *   - registerExistingPushGrant() → silently (re)register a token IF the user has
 *                                   already granted permission (no prompt)
 *   - onForegroundPush(cb)        → in-tab message handler
 *
 * All functions no-op safely when unsupported or when NEXT_PUBLIC_FIREBASE_VAPID_KEY
 * is absent. The background SW lives at public/firebase-messaging-sw.js.
 */

import { getMessaging, getToken, onMessage, isSupported, type MessagePayload } from 'firebase/messaging';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { log } from '@/lib/logger';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

function getApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (getApps().length > 0) return getApps()[0]!;
  // Mirror firebase-client.ts config (kept minimal — messaging only needs these).
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAOwypGtSAeCsZpHogZx7Jt_MPX2nh3GZM',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'nilamit-52073.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'nilamit-52073',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'nilamit-52073.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '884637735592',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:884637735592:web:b817a744a54f15a663409d',
  });
}

async function supported(): Promise<boolean> {
  if (typeof window === 'undefined' || !VAPID_KEY) return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

async function registerToken(): Promise<string | null> {
  const app = getApp();
  if (!app) return null;
  try {
    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
      ?? (await navigator.serviceWorker.register('/firebase-messaging-sw.js'));
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return null;

    await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return token;
  } catch (err) {
    log.warn('[FCM] token registration failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Request notification permission (from a user gesture) and register a token.
 * Returns the token, or null if denied/unsupported.
 */
export async function enablePushNotifications(): Promise<string | null> {
  if (!(await supported())) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    return await registerToken();
  } catch (err) {
    log.warn('[FCM] enablePushNotifications failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Silently (re)register a token IF permission was already granted. Safe to call
 * on every load — it never prompts. This is what actually keeps fcmTokens fresh
 * for already-opted-in users.
 */
export async function registerExistingPushGrant(): Promise<void> {
  if (!(await supported())) return;
  if (Notification.permission !== 'granted') return;
  await registerToken();
}

/** In-tab message handler. Returns an unsubscribe function (no-op if unsupported). */
export async function onForegroundPush(cb: (payload: MessagePayload) => void): Promise<() => void> {
  if (!(await supported())) return () => {};
  const app = getApp();
  if (!app) return () => {};
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, cb);
  } catch {
    return () => {};
  }
}
