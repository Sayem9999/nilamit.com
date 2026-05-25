"use client";

import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Gavel,
  Users,
  Percent,
  Sparkles,
  TrendingUp,
  Loader2,
  Lock,
} from "lucide-react";
import Link from "next/link";

export default function RetailerPerksPage() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const user = session.user as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const salesCount = user.salesCount || 0;
  const rating = user.rating || 0;

  // Tiers calculation logic
  const currentTier = user.isRetailer 
    ? "Professional Retailer" 
    : user.isVerifiedSeller 
      ? "Verified Seller" 
      : "Basic Bidder";

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/retailer/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors focus-visible:outline-none"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Seller Hub
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  Seller Tiers & Perks
                </h1>
                <p className="text-gray-400 text-sm font-medium mt-1">
                  eBay-style performance levels, platform commission discounts, and custom storefront unlocks.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Progress Indicator */}
        <section className="bg-[#141417] border border-white/5 rounded-[2rem] p-8 mb-8">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            Your Performance Track
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0a0a0b] border border-white/5 rounded-2xl p-6">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Current Tier</p>
              <p className="text-xl font-black text-white flex items-center gap-1.5 mt-1">
                {currentTier}
              </p>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">
                {user.isRetailer 
                  ? "Maximum privileges unlocked: bulk sync, pro templates, and lowest commission rates."
                  : user.isVerifiedSeller 
                    ? "Verified for individual listings and core seller features."
                    : "Upgrade by verifying email in profile settings."}
              </p>
            </div>

            <div className="bg-[#0a0a0b] border border-white/5 rounded-2xl p-6">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Total Sales Count</p>
              <p className="text-2xl font-black text-white mt-1">
                {salesCount} <span className="text-xs text-gray-500 font-bold">Ended Auctions</span>
              </p>
              <div className="w-full bg-white/5 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (salesCount / 10) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-2 font-medium">
                {salesCount >= 10 ? "Benchmark satisfied for high-volume sales!" : `${10 - salesCount} more sales to reach Retailer standard.`}
              </p>
            </div>

            <div className="bg-[#0a0a0b] border border-white/5 rounded-2xl p-6">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Feedback Rating</p>
              <p className="text-2xl font-black text-white mt-1 flex items-baseline gap-1">
                {rating.toFixed(1)} <span className="text-xs text-amber-500">★</span>
              </p>
              <div className="w-full bg-white/5 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (rating / 5) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-2 font-medium">
                {rating >= 4.5 ? "Top-rated seller status active!" : "Maintain at least 4.5 rating for Top Seller perks."}
              </p>
            </div>
          </div>
        </section>

        {/* Benefits Comparison Grid */}
        <section className="bg-[#141417] border border-white/5 rounded-[2rem] p-8 overflow-x-auto">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Comparison Table & Privileges
          </h3>

          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <th className="py-4">Feature / Privilege</th>
                <th className="py-4 text-center">Basic Bidder</th>
                <th className="py-4 text-center">Verified Seller</th>
                <th className="py-4 text-center">Pro Retailer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm font-medium">
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 flex items-center gap-2 font-bold text-white">
                  <Users className="w-4 h-4 text-gray-400" />
                  Buying & Bidding
                </td>
                <td className="py-4 text-center text-emerald-400">Unlimited</td>
                <td className="py-4 text-center text-emerald-400">Unlimited</td>
                <td className="py-4 text-center text-emerald-400">Unlimited</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 font-bold text-white">Individual Listings limit</td>
                <td className="py-4 text-center text-gray-400">3 active</td>
                <td className="py-4 text-center text-indigo-400 font-bold">Unlimited</td>
                <td className="py-4 text-center text-indigo-400 font-bold">Unlimited</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 font-bold text-white">Bulk Inventory Sync</td>
                <td className="py-4 text-center text-red-500"><Lock className="w-3.5 h-3.5 mx-auto" /></td>
                <td className="py-4 text-center text-red-500"><Lock className="w-3.5 h-3.5 mx-auto" /></td>
                <td className="py-4 text-center text-emerald-400 font-bold">CSV Enabled</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 flex items-center gap-2 font-bold text-white">
                  <Percent className="w-4 h-4 text-gray-400" />
                  Commission Rate
                </td>
                <td className="py-4 text-center text-gray-400">5.0%</td>
                <td className="py-4 text-center text-blue-400 font-bold">0% (Promo active)</td>
                <td className="py-4 text-center text-indigo-400 font-black">0% (Promo active)</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 font-bold text-white">Dynamic Storefront Biography</td>
                <td className="py-4 text-center text-red-500"><Lock className="w-3.5 h-3.5 mx-auto" /></td>
                <td className="py-4 text-center text-emerald-400">Enabled</td>
                <td className="py-4 text-center text-emerald-400">Enabled</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 font-bold text-white">Escrow Release Speed</td>
                <td className="py-4 text-center text-gray-400">Standard (7 days)</td>
                <td className="py-4 text-center text-gray-400">Standard (7 days)</td>
                <td className="py-4 text-center text-emerald-400 font-bold">Priority (3 days)</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-4 font-bold text-white">Support SLA</td>
                <td className="py-4 text-center text-gray-400">Standard</td>
                <td className="py-4 text-center text-gray-400">Standard</td>
                <td className="py-4 text-center text-emerald-400 font-bold">Priority Response</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* dynamic prompt to upgrade */}
        {!user.isRetailer && (
          <div className="mt-8 p-6 bg-gradient-to-r from-indigo-900/40 to-indigo-800/10 border border-indigo-500/20 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h4 className="text-md font-bold text-white mb-1">Unlock Pro Retailer Privileges Instantly</h4>
              <p className="text-xs text-gray-400 leading-relaxed font-medium">
                Want to bulk upload inventory via CSV or unlock priority escrow releases? Perform a self-service upgrade on your settings page now.
              </p>
            </div>
            <Link 
              href="/retailer/settings"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-center shrink-0"
            >
              Go to Tier Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
