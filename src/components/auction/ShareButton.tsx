"use client";

import { Share2, Facebook, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface ShareButtonProps {
  title: string;
  auctionId: string;
  price: number;
}

export function ShareButton({ title, auctionId, price }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/en/auctions/${auctionId}`
      : `https://nilamit.com/en/auctions/${auctionId}`;
  const text = `${title} — ৳${price.toLocaleString()} on Nilamit`;

  const share = async (platform: string) => {
    setOpen(false);
    switch (platform) {
      case "native":
        if (navigator.share) {
          await navigator.share({ title, text, url });
        }
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank",
          "width=600,height=400",
        );
        break;
      case "whatsapp":
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
          "_blank",
        );
        break;
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
        break;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full bg-white/80 backdrop-blur-md text-gray-500 hover:text-indigo-600 hover:bg-white transition-all"
        title="Share"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-2 min-w-[180px] animate-in fade-in slide-in-from-top-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={() => share("native")}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4 text-indigo-500" /> Share via...
              </button>
            )}
            <button
              onClick={() => share("facebook")}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Facebook className="w-4 h-4 text-blue-600" /> Facebook
            </button>
            <button
              onClick={() => share("whatsapp")}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
            </button>
            <button
              onClick={() => share("copy")}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Link2 className="w-4 h-4 text-gray-500" /> Copy Link
            </button>
          </div>
        </>
      )}
    </div>
  );
}
