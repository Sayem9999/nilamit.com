"use client";

/**
 * Firebase Remote Config — runtime-flag layer.
 *
 * Lets the team flip feature flags / tune numeric parameters (e.g. anti-snipe
 * window, commission %, hero banner variant) without a redeploy. Values
 * propagate within ~12 hours by default; force-fetch with `refresh()` for
 * faster propagation in admin UIs.
 *
 * Sits *above* SystemConfig (Firestore-stored admin overrides) in priority:
 *   Remote Config value > SystemConfig (Firestore) > hard-coded default.
 *
 * Client-side only. Calls are guarded by typeof window check.
 */

import { getRemoteConfig, fetchAndActivate, getValue, type RemoteConfig } from "firebase/remote-config";
import { initializeApp, getApps } from "firebase/app";
import { log } from "@/lib/logger";

export interface RemoteConfigDefaults {
  heroBannerVariant: "default" | "festival" | "ramadan";
  antiSnipeSeconds: number;
  commissionPercentage: number;
  bidCooldownMs: number;
  featuredAuctionLimit: number;
  enableProxyBidding: boolean;
}

const DEFAULTS: RemoteConfigDefaults = {
  heroBannerVariant: "default",
  antiSnipeSeconds: 60,
  commissionPercentage: 2.5,
  bidCooldownMs: 1500,
  featuredAuctionLimit: 4,
  enableProxyBidding: true,
};

let _rc: RemoteConfig | null = null;
let _initPromise: Promise<RemoteConfig | null> | null = null;

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

async function init(): Promise<RemoteConfig | null> {
  if (typeof window === "undefined") return null;
  if (_rc) return _rc;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const app = getApps().length > 0 ? getApps()[0]! : initializeApp(FIREBASE_CONFIG);
      const rc = getRemoteConfig(app);

      // Defaults must be a Record<string, string|number|boolean>, not nested.
      rc.defaultConfig = DEFAULTS as unknown as Record<string, string | number | boolean>;

      // 12-hour minimum fetch interval in prod, 0 in dev so we see flag flips immediately.
      rc.settings.minimumFetchIntervalMillis =
        process.env.NODE_ENV === "production" ? 12 * 60 * 60 * 1000 : 0;

      await fetchAndActivate(rc);
      _rc = rc;
      return rc;
    } catch (err) {
      log.warn("[RemoteConfig] init failed — falling back to defaults", { error: String(err) });
      return null;
    }
  })();

  return _initPromise;
}

/**
 * Read a Remote Config value. Falls back to the hard-coded default if RC
 * isn't initialized yet or the fetch failed. Always returns a value — never
 * undefined — so callers don't need null-checks.
 */
export async function getRemote<K extends keyof RemoteConfigDefaults>(
  key: K,
): Promise<RemoteConfigDefaults[K]> {
  const rc = await init();
  const fallback = DEFAULTS[key];
  if (!rc) return fallback;

  try {
    const v = getValue(rc, key as string);
    if (typeof fallback === "number") return v.asNumber() as RemoteConfigDefaults[K];
    if (typeof fallback === "boolean") return v.asBoolean() as RemoteConfigDefaults[K];
    return v.asString() as RemoteConfigDefaults[K];
  } catch {
    return fallback;
  }
}

/** Force a fresh fetch — useful in admin UIs after flipping a flag. */
export async function refreshRemoteConfig(): Promise<void> {
  const rc = await init();
  if (!rc) return;
  rc.settings.minimumFetchIntervalMillis = 0;
  await fetchAndActivate(rc);
}
