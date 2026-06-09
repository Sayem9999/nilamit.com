"use client";

import { useState } from "react";
import { 
  FileText, 
  Truck, 
  UserCheck, 
  ShieldCheck, 
  Coins, 
  CheckCircle2, 
  Star, 
  ShieldAlert,
  Flame,
  Award,
  TrendingUp
} from "lucide-react";

interface AuctionDetailTabsProps {
  description: string;
  location?: string;
  seller: {
    id: string;
    name?: string | null;
    image?: string | null;
    rating?: number;
    ratingCount?: number;
    userLevel?: number;
    winningStreak?: number;
    isVerifiedSeller?: boolean;
    isTopRated?: boolean;
  };
  commissionRate?: number;
}

export function AuctionDetailTabs({
  description,
  location = "Bangladesh",
  seller,
  commissionRate = 5
}: AuctionDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"description" | "shipping" | "seller">("description");

  // Calculate positive feedback percentage based on rating (out of 5)
  const hasReviews = typeof seller.ratingCount === 'number' && seller.ratingCount > 0;
  const feedbackPercentage = hasReviews && seller.rating 
    ? Math.min(100, Math.round((seller.rating / 5) * 100)) 
    : null;

  return (
    <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-premium">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-100 bg-gray-50/50 p-1.5 gap-1.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "description"}
          aria-controls="tab-panel-description"
          onClick={() => setActiveTab("description")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === "description"
              ? "bg-white text-primary-600 shadow-sm border border-gray-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Description</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "shipping"}
          aria-controls="tab-panel-shipping"
          onClick={() => setActiveTab("shipping")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === "shipping"
              ? "bg-white text-primary-600 shadow-sm border border-gray-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Shipping & Advance Payment</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "seller"}
          aria-controls="tab-panel-seller"
          onClick={() => setActiveTab("seller")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === "seller"
              ? "bg-white text-primary-600 shadow-sm border border-gray-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Seller Feedback</span>
        </button>
      </div>

      {/* Tabs Content */}
      <div className="p-6">
        {/* Tab 1: Description */}
        {activeTab === "description" && (
          <div 
            id="tab-panel-description" 
            role="tabpanel" 
            className="animate-in fade-in duration-300"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-450 mb-3">Item Description</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm sm:text-base font-medium">
              {description}
            </p>
          </div>
        )}

        {/* Tab 2: Shipping & Payments */}
        {activeTab === "shipping" && (
          <div 
            id="tab-panel-shipping" 
            role="tabpanel" 
            className="space-y-6 animate-in fade-in duration-300"
          >
            <div className="grid md:grid-cols-2 gap-6">
              {/* Buyer Protection Mechanism */}
              <div className="bg-primary-50/30 rounded-md border border-primary-100/50 p-5 space-y-3">
                <h4 className="flex items-center gap-2 font-bold text-primary-800 text-sm uppercase tracking-wide">
                  <ShieldCheck className="w-4.5 h-4.5 text-primary-600" />
                  Nilamit Buyer Protection Guarantee
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  We secure trade safety through secure mobile money advance payments. When you win, you send the deposit/full amount to secure Nilamit Treasury bKash/Nagad accounts.
                </p>
                <ul className="space-y-2 text-[11px] text-gray-600 font-medium">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    <span>Funds are held securely by Nilamit until successful trade verification.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    <span>Buyer inspects item first before releasing payment to seller.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    <span>Full dispute safeguards protect both buyers and sellers.</span>
                  </li>
                </ul>
              </div>

              {/* Logistics & Commission */}
              <div className="bg-slate-50 border border-gray-100 rounded-md p-5 space-y-4">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wide mb-2">
                    <Truck className="w-4 h-4 text-primary-500" />
                    Local Handoff & Courier Dispatch
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Nilamit is a direct-trade peer-to-peer marketplace. Buyers and sellers chat directly in active conversations to arrange face-to-face meetups, direct handoffs, or self-directed courier deliveries (e.g. Pathao, Steadfast, Redx) in <span className="font-bold text-gray-800">{location}</span>.
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-200/60">
                  <h4 className="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wide mb-1">
                    <Coins className="w-4 h-4 text-amber-500" />
                    Commission Policy
                  </h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {commissionRate && commissionRate > 0 ? (
                      `Nilamit charges a standard ${commissionRate}% seller success fee only on successfully completed transactions. Bidding is 100% free with no deposit requirements.`
                    ) : (
                      "Nilamit is currently 100% free with a 0% success fee! Listing, bidding, and selling are completely free with no platform commission cuts."
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Buyer/Seller Handoff Banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-md p-4 text-xs text-amber-800">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider block mb-1">Safe Bidding Guarantee</span>
                Never pay a seller directly outside the Nilamit platform! Always utilize the secure treasury accounts shown on the dashboard after winning to be fully covered by our Nilamit Advance Payment Guarantee.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Seller Performance */}
        {activeTab === "seller" && (
          <div 
            id="tab-panel-seller" 
            role="tabpanel" 
            className="space-y-6 animate-in fade-in duration-300"
          >
            {/* Scoreboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-100 p-4 rounded-md shadow-sm text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Positive Feedback</span>
                <span className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight block">
                  {feedbackPercentage !== null ? `${feedbackPercentage}%` : "—"}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block">
                  {seller.ratingCount || 0} reviews
                </span>
              </div>

              <div className="bg-white border border-gray-100 p-4 rounded-md shadow-sm text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Seller Level</span>
                <span className="text-xl sm:text-2xl font-bold text-primary-600 tracking-tight flex items-center justify-center gap-1">
                  <Award className="w-5 h-5 text-primary-500 animate-pulse" />
                  Level {seller.userLevel || 1}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block">Active Bidding Shield</span>
              </div>

              <div className="bg-white border border-gray-100 p-4 rounded-md shadow-sm text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Winning Streak</span>
                <span className="text-xl sm:text-2xl font-bold text-orange-600 tracking-tight flex items-center justify-center gap-1">
                  <Flame className="w-5 h-5 text-orange-500" />
                  {seller.winningStreak || 0}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block">Consecutive sales</span>
              </div>

              <div className="bg-white border border-gray-100 p-4 rounded-md shadow-sm text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">Seller Badges</span>
                <div className="flex justify-center gap-1.5 pt-1">
                  {seller.isVerifiedSeller && (
                    <span className="bg-blue-50 border border-blue-200 text-blue-600 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      VERIFIED
                    </span>
                  )}
                  {seller.isTopRated && (
                    <span className="bg-amber-50 border border-amber-200 text-amber-600 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      TOP RATED
                    </span>
                  )}
                  {!seller.isVerifiedSeller && !seller.isTopRated && (
                    <span className="text-xs text-gray-400 italic">No extra badges</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block pt-0.5">Trust markers</span>
              </div>
            </div>

            {/* Dynamic Detailed Stats Card */}
            <div className="bg-slate-50 border border-gray-100 rounded-md p-5 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Trusted Shop Standing</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {hasReviews
                      ? "This seller satisfies all platform response time guidelines and dispute handling measures."
                      : "New seller: This merchant has not received any reviews yet. Secure trade guaranteed via Nilamit Advance Payment."}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={`w-5 h-5 ${
                      hasReviews && star <= (seller.rating || 5) 
                        ? "text-amber-400 fill-amber-400" 
                        : "text-gray-200"
                    }`} 
                  />
                ))}
                <span className="text-xs font-bold text-gray-800 ml-1.5">
                  ({hasReviews ? (seller.rating || 5.0).toFixed(1) : "0.0"})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
