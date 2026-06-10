"use client";

import { useEffect, useState } from "react";
import { Download, Share, CheckCircle2, Smartphone } from "lucide-react";

/** Chrome's non-standard install-prompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Cross-platform "get the app" affordance:
 *  - Android/desktop Chrome → real PWA install via beforeinstallprompt.
 *  - iOS Safari → "Add to Home Screen" instructions (no programmatic install).
 *  - Android APK → direct download of the TWA-built signed APK from
 *    /downloads/nilamit.apk (built via Bubblewrap — see docs/MOBILE.md).
 *
 * Platform-specific UI is gated behind `mounted` so SSR and the first client
 * render are identical (no hydration mismatch); detection then runs client-side.
 */
export function InstallAppButton() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedViaEvent, setInstalledViaEvent] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only gate; cannot be derived during SSR render
    setMounted(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalledViaEvent(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Derived only after mount → window is defined and no SSR/client divergence.
  const ua = mounted ? window.navigator.userAgent : "";
  const isIOS = mounted && /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
  const standalone =
    mounted &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);
  const installed = standalone || installedViaEvent;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (installed) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
        <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> App installed — open Nilamit from your home screen.
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
      {deferred && (
        <button
          type="button"
          onClick={install}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-600 text-white text-sm font-bold shadow-sm hover:bg-primary-700 active:scale-95 transition-all"
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" /> Install app
        </button>
      )}

      <a
        href="/downloads/nilamit.apk"
        download
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:border-primary-400 hover:text-primary-700 active:scale-95 transition-all"
      >
        <Download className="w-4 h-4" aria-hidden="true" /> Download Android APK
      </a>

      {isIOS && (
        <p className="inline-flex items-center gap-1.5 text-xs text-gray-500 max-w-xs text-center">
          <Share className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          On iPhone: tap <strong className="mx-1">Share</strong> → <strong className="ml-1">Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}
