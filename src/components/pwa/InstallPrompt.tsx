"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * PWA install prompt — slim toast that surfaces after a user has interacted
 * with the site at least once (we don't ambush first-time visitors).
 *
 * Hooks the `beforeinstallprompt` event (Chromium browsers). Once dismissed
 * we won't re-prompt for 30 days (localStorage flag). iOS Safari has no
 * programmatic install API; we show a one-time Add-to-Home-Screen tip
 * instead via a separate detection path (TODO).
 *
 * Mount once near the root layout. Returns null on SSR + when conditions
 * aren't met — never renders a placeholder.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_STORAGE_KEY = "nilamit-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed?
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Recently dismissed?
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY) || 0);
      if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;
    } catch {
      // No storage — show prompt anyway.
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Wait 15s into the visit before surfacing — first impression matters.
      setTimeout(() => setShow(true), 15_000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || !deferred) return null;

  const handleInstall = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") {
        try {
          localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    } finally {
      setShow(false);
      setDeferred(null);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install Nilamit app"
      className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm z-50 bg-white border border-gray-200 shadow-lg rounded-md p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="w-10 h-10 bg-primary-50 rounded-md flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 leading-tight">
          Install the Nilamit app
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">
          Faster loading, offline browsing, instant bid notifications.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-md transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="text-gray-400 hover:text-gray-600 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
