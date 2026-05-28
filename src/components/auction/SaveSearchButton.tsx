"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { createSavedSearch } from "@/actions/saved-search";

interface Props {
  /** Active filter combo from /auctions to persist. */
  filters: {
    search?: string;
    category?: string;
    location?: string;
    condition?: "NEW" | "USED" | "REFURBISHED";
  };
}

/**
 * "Save this search" button on /auctions.
 *
 * Tap → modal asks for an optional label (defaults to a sensible auto-name)
 * + notification preferences (in-app + push by default). On submit, hits
 * createSavedSearch Server Action. Cron will later match new auctions
 * against this filter and fire the notification (TODO).
 *
 * Hidden for anonymous users — saving needs an account.
 */
export function SaveSearchButton({ filters }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!session?.user) return null;

  // Auto-generate a label like "Mobile phones in Mirpur" from the filters.
  const autoLabel =
    [
      filters.search,
      filters.category && filters.category !== "all" ? filters.category : null,
      filters.location ? `in ${filters.location}` : null,
      filters.condition,
    ]
      .filter(Boolean)
      .join(" · ") || "All listings";

  const handleSave = () => {
    startTransition(async () => {
      const res = await createSavedSearch({
        label: (label || autoLabel).slice(0, 80),
        filters,
        notify: { inApp: true, fcm: true, email: notifyEmail },
      });
      if (res.success) {
        toast.success("Saved. We'll notify you on new matches.");
        setSaved(true);
        setOpen(false);
      } else {
        toast.error(res.error?.message || "Save failed");
      }
    });
  };

  if (saved) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
        <BookmarkCheck className="w-3.5 h-3.5" />
        Saved
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors"
      >
        <Bookmark className="w-3.5 h-3.5" />
        Save this search
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-md shadow-lg max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">Save this search</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={autoLabel}
              maxLength={80}
              className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none mb-3"
            />

            <label className="flex items-center gap-2 mb-2 text-sm">
              <input type="checkbox" checked={true} disabled className="rounded" />
              In-app + push notifications
            </label>
            <label className="flex items-center gap-2 mb-4 text-sm">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="rounded"
              />
              Also email me when there&apos;s a match
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
