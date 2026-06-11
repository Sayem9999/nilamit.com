"use client";

import { Share2, Facebook, Link2, MessageCircle, Send, Twitter, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { formatBDT } from "@/lib/format";

interface ShareButtonProps {
  title: string;
  auctionId: string;
  price: number;
  /**
   * Compact = a single quick-share icon (native share sheet on mobile, copy-link
   * fallback on desktop). Used inside AuctionCard, where a dropdown would be
   * clipped by the card's overflow-hidden and conflict with the card <Link>.
   */
  compact?: boolean;
  className?: string;
}

type SharePlatform = "native" | "facebook" | "whatsapp" | "telegram" | "x" | "copy";

export function ShareButton({ title, auctionId, price, compact = false, className = "" }: ShareButtonProps) {
  const t = useTranslations("Share");
  const [open, setOpen] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/auctions/${auctionId}`
      : `https://www.nilamit.com/auctions/${auctionId}`;
  const text = `${title} — ${formatBDT(price)} on Nilamit`;

  const popup = (href: string) =>
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=520");

  const share = async (platform: SharePlatform) => {
    setOpen(false);
    switch (platform) {
      case "native":
        try {
          if (typeof navigator !== "undefined" && navigator.share) {
            await navigator.share({ title, text, url });
          } else {
            await navigator.clipboard.writeText(url);
            toast.success(t("copied"));
          }
        } catch {
          /* user dismissed the native sheet — not an error */
        }
        break;
      case "facebook":
        popup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        break;
      case "whatsapp":
        popup(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`);
        break;
      case "telegram":
        popup(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        break;
      case "x":
        popup(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        break;
      case "copy":
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("copied"));
        } catch {
          /* clipboard blocked — silently ignore */
        }
        break;
    }
  };

  // ─── Compact quick-share (cards) ───────────────────────────────────────────
  if (compact) {
    return (
      <button
        type="button"
        aria-label={t("shareAuction")}
        // Stop the parent <Link> from navigating to the auction page.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void share("native");
        }}
        className={`inline-flex items-center justify-center rounded-full bg-white/80 text-gray-500 hover:text-indigo-600 hover:bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${className}`}
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
      </button>
    );
  }

  // ─── Full dropdown (detail page) ───────────────────────────────────────────
  const items: { platform: SharePlatform; label: string; icon: React.ReactNode; show?: boolean }[] = [
    {
      platform: "native",
      label: t("via"),
      icon: <Share2 className="w-4 h-4 text-indigo-500" />,
      show: typeof navigator !== "undefined" && "share" in navigator,
    },
    { platform: "facebook", label: t("facebook"), icon: <Facebook className="w-4 h-4 text-blue-600" /> },
    { platform: "whatsapp", label: t("whatsapp"), icon: <MessageCircle className="w-4 h-4 text-green-600" /> },
    { platform: "telegram", label: t("telegram"), icon: <Send className="w-4 h-4 text-sky-500" /> },
    { platform: "x", label: t("x"), icon: <Twitter className="w-4 h-4 text-gray-900" /> },
    { platform: "copy", label: t("copy"), icon: <Link2 className="w-4 h-4 text-gray-500" /> },
  ];

  // Live share-card PNG (current bid + countdown) — opens in a new tab so the
  // poster can save it and drop it into FB groups / WhatsApp (GROWTH.md flow).
  const openShareCard = () => {
    window.open(`/api/share-card/${auctionId}`, "_blank", "noopener");
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t("shareAuction")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/80 text-gray-500 hover:text-indigo-600 hover:bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        <Share2 className="w-5 h-5" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={t("menuLabel")}
            className="absolute right-0 top-full mt-2 z-50 bg-white rounded-md shadow-lg border border-gray-100 p-2 min-w-[190px] animate-in fade-in slide-in-from-top-2"
          >
            {items
              .filter((it) => it.show !== false)
              .map((it) => (
                <button
                  key={it.platform}
                  role="menuitem"
                  onClick={() => share(it.platform)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  {it.icon} {it.label}
                </button>
              ))}
            <button
              role="menuitem"
              onClick={openShareCard}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors border-t border-gray-100 mt-1 pt-2.5"
            >
              <ImageIcon className="w-4 h-4 text-amber-500" /> {t("shareCard")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
