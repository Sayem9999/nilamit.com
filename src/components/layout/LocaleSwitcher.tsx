"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { setLocale } from "@/actions/locale";
import { useUIStore } from "@/stores/ui-store";

/**
 * Tiny EN | বাং toggle for the utility row of the navbar.
 *
 * Calls the setLocale Server Action (writes NEXT_LOCALE cookie + revalidates)
 * and mirrors the value into the Zustand UI store so other client components
 * can read it without a round-trip.
 */
export function LocaleSwitcher() {
  const [pending, startTransition] = useTransition();
  const locale = useUIStore((s) => s.locale);
  const setStoreLocale = useUIStore((s) => s.setLocale);

  const switchTo = (next: "en" | "bn") => {
    if (next === locale) return;
    setStoreLocale(next);
    startTransition(async () => {
      await setLocale(next);
    });
  };

  return (
    <div className="inline-flex items-center gap-1 text-[12px]">
      <Globe className="w-3 h-3 text-gray-400" aria-hidden="true" />
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        aria-pressed={locale === "en"}
        className={`px-1.5 rounded transition-colors ${
          locale === "en"
            ? "font-bold text-gray-900"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        EN
      </button>
      <span className="text-gray-300">|</span>
      <button
        type="button"
        onClick={() => switchTo("bn")}
        disabled={pending}
        aria-pressed={locale === "bn"}
        className={`px-1.5 rounded transition-colors ${
          locale === "bn"
            ? "font-bold text-gray-900"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        বাং
      </button>
    </div>
  );
}
