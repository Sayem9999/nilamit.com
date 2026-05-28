"use client";

import { useSession } from "next-auth/react";
import {
  Gavel,
  Users,
  Percent,
  Sparkles,
  TrendingUp,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function RetailerPerksPage() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-650" />
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
    : "Standard Trader";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pt-36 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3 font-heading">
                  Seller Tiers & Perks
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Professional performance levels, platform commission discounts, and custom storefront unlocks.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Progress Indicator */}
        <section className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 font-heading">
            <TrendingUp className="w-5 h-5 text-indigo-650" />
            Your Performance Track
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 border border-slate-150 rounded-md p-6">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Current Tier</p>
              <p className="text-xl font-bold text-slate-900 flex items-center gap-1.5 mt-1 font-heading">
                {currentTier}
              </p>
              <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed">
                {user.isRetailer 
                  ? "Maximum privileges unlocked: pro templates and lowest commission rates."
                  : user.isVerifiedSeller 
                    ? "Verified for individual listings and core seller features."
                    : "Upgrade by verifying email in profile settings."}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-md p-6">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Total Sales Count</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-heading">
                {salesCount} <span className="text-xs text-slate-500 font-bold">Ended Auctions</span>
              </p>
              <div className="w-full bg-slate-200/80 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (salesCount / 10) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-500 mt-2 font-medium">
                {salesCount >= 10 ? "Benchmark satisfied for high-volume sales!" : `${10 - salesCount} more sales to reach Retailer standard.`}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-md p-6">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Feedback Rating</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 flex items-baseline gap-1 font-heading">
                {rating.toFixed(1)} <span className="text-xs text-amber-500">★</span>
              </p>
              <div className="w-full bg-slate-200/80 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (rating / 5) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-500 mt-2 font-medium">
                {rating >= 4.5 ? "Top-rated seller status active!" : "Maintain at least 4.5 rating for Top Seller perks."}
              </p>
            </div>
          </div>
        </section>

        {/* Benefits Comparison Grid */}
        <section className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 overflow-x-auto">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 font-heading">
            <Sparkles className="w-5 h-5 text-indigo-650" />
            Comparison Table & Privileges
          </h3>

          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50/50">
                <th className="py-4 px-3">Feature / Privilege</th>
                <th className="py-4 text-center">Standard Trader</th>
                <th className="py-4 text-center">Pro Retailer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                <td className="py-4 px-3 flex items-center gap-2 font-bold text-slate-900">
                  <Users className="w-4 h-4 text-slate-400" />
                  Buying & Bidding
                </td>
                <td className="py-4 text-center text-emerald-600 font-bold">Unlimited</td>
                <td className="py-4 text-center text-emerald-600 font-bold">Unlimited</td>
              </tr>
              <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                <td className="py-4 px-3 font-bold text-slate-900">Individual Listings limit</td>
                <td className="py-4 text-center text-indigo-600 font-bold">Unlimited</td>
                <td className="py-4 text-center text-indigo-600 font-bold">Unlimited</td>
              </tr>

              <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                <td className="py-4 px-3 flex items-center gap-2 font-bold text-slate-900">
                  <Percent className="w-4 h-4 text-slate-400" />
                  Commission Rate
                </td>
                <td className="py-4 text-center text-blue-600 font-bold">0% (Promo active)</td>
                <td className="py-4 text-center text-indigo-600 font-bold">0% (Promo active)</td>
              </tr>
              <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                <td className="py-4 px-3 font-bold text-slate-900">Dynamic Storefront Biography</td>
                <td className="py-4 text-center text-emerald-600 font-bold">Enabled</td>
                <td className="py-4 text-center text-emerald-600 font-bold">Enabled</td>
              </tr>
              <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                <td className="py-4 px-3 font-bold text-slate-900">Escrow Release Speed</td>
                <td className="py-4 text-center text-slate-500">Standard (7 days)</td>
                <td className="py-4 text-center text-emerald-600 font-bold">Priority (3 days)</td>
              </tr>
              <tr className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                <td className="py-4 px-3 font-bold text-slate-900">Support SLA</td>
                <td className="py-4 text-center text-slate-500">Standard</td>
                <td className="py-4 text-center text-emerald-600 font-bold">Priority Response</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* dynamic prompt to upgrade */}
        {!user.isRetailer && (
          <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h4 className="text-md font-bold text-indigo-950 mb-1 font-heading">Unlock Pro Retailer Privileges Instantly</h4>
              <p className="text-xs text-indigo-855/80 leading-relaxed font-medium">
                Want to unlock priority escrow releases or premium store badges? Perform a self-service upgrade on your settings page now.
              </p>
            </div>
            <Link 
              href="/retailer/settings"
              className="px-6 py-3 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-indigo-650/10 hover:shadow-lg transition-all text-center shrink-0"
            >
              Go to Tier Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
