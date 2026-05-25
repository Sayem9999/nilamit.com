"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { updateRetailerSettings, toggleRetailerUpgrade } from "@/actions/retailer-settings";
import {
  ArrowLeft,
  Gavel,
  ShieldCheck,
  Building,
  MapPin,
  FileText,
  Smartphone,
  Sparkles,
  Loader2,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function RetailerSettingsPage() {
  const { data: session, update } = useSession();
  const [isPending, startTransition] = useTransition();
  const [isUpgrading, startUpgradeTransition] = useTransition();

  // Form states
  const [businessName, setBusinessName] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [bkashNumber, setBkashNumber] = useState("");
  const [nagadNumber, setNagadNumber] = useState("");
  const [bio, setBio] = useState("");

  // Hydrate form once session loads
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (session?.user) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const u = session.user as any;
      setBusinessName(u.businessName || u.name || "");
      setBusinessLocation(u.businessLocation || "");
      setBkashNumber(u.bkashNumber || "");
      setNagadNumber(u.nagadNumber || "");
      setBio(u.bio || "");
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [session]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateRetailerSettings({
        businessName: businessName.trim(),
        businessLocation: businessLocation.trim(),
        bkashNumber: bkashNumber.trim(),
        nagadNumber: nagadNumber.trim(),
        bio: bio.trim(),
      });

      if (res.success) {
        toast.success("Business profile saved successfully!");
        await update(); // Sync JWT session
      } else {
        toast.error(res.error?.message || "Failed to save profile.");
      }
    });
  };

  const handleToggleTier = () => {
    const nextStatus = !user.isRetailer;
    startUpgradeTransition(async () => {
      const res = await toggleRetailerUpgrade(nextStatus);
      if (res.success) {
        toast.success(
          nextStatus 
            ? "Upgraded to Professional Retailer! Bulk upload is now unlocked."
            : "Downgraded to Verified Seller."
        );
        await update(); // Sync JWT session
      } else {
        toast.error(res.error?.message || "Failed to toggle tier.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
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
                <h1 className="text-3xl font-black tracking-tight text-white">
                  Business Settings
                </h1>
                <p className="text-gray-400 text-sm font-medium mt-1">
                  Manage payouts, storefront metadata, and seller tiers.
                </p>
              </div>
            </div>
            
            {/* Categorization Status */}
            <div className="flex items-center gap-3">
              <div className={`px-4 py-1.5 border rounded-full flex items-center gap-2 ${
                user.isRetailer
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              }`}>
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {user.isRetailer ? "Pro Retailer" : "Verified Seller"}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Forms */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Details Card */}
              <div className="bg-[#141417] border border-white/5 rounded-[2rem] p-8 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Building className="w-5 h-5 text-indigo-400" />
                  Storefront Profile
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="businessName" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Business / Display Name
                    </label>
                    <input
                      id="businessName"
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Dhaka Electronics Hub"
                      required
                      className="w-full bg-[#0a0a0b] border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-gray-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="businessLocation" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Business Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        id="businessLocation"
                        type="text"
                        value={businessLocation}
                        onChange={(e) => setBusinessLocation(e.target.value)}
                        placeholder="e.g. Mirpur, Dhaka"
                        className="w-full bg-[#0a0a0b] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-gray-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bio" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      About / Business Biography
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                      <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell buyers about your shop, shipping speed, and specialty..."
                        rows={4}
                        className="w-full bg-[#0a0a0b] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-gray-600 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* MFS Credentials Card */}
              <div className="bg-[#141417] border border-white/5 rounded-[2rem] p-8 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  MFS Payment Credentials
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                  Provide verified bKash or Nagad numbers to receive automatic settlements upon escrow releases.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bkashNumber" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      bKash Personal Number
                    </label>
                    <input
                      id="bkashNumber"
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      placeholder="e.g. 017XXXXXXXX"
                      className="w-full bg-[#0a0a0b] border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-gray-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="nagadNumber" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Nagad Personal Number
                    </label>
                    <input
                      id="nagadNumber"
                      type="text"
                      value={nagadNumber}
                      onChange={(e) => setNagadNumber(e.target.value)}
                      placeholder="e.g. 019XXXXXXXX"
                      className="w-full bg-[#0a0a0b] border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-gray-600"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-4 bg-white text-black hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-400 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {isPending ? "Saving..." : "Save Business Settings"}
              </button>
            </form>
          </div>

          {/* Sidebar Tier Upgrade Controller */}
          <div className="space-y-6">
            <div className="bg-[#141417] border border-white/5 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-md font-bold text-white">Tier Control Center</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-[#0a0a0b] border border-white/5 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Current Level</p>
                  <p className="text-lg font-black text-white flex items-center gap-1.5">
                    {user.isRetailer ? "Professional Retailer" : "Verified Seller"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                    {user.isRetailer 
                      ? "Full access to high-volume bulk inventory sync, pro badges, and 0% escrow promotional fees."
                      : "Access to the standard Seller Hub, unlimited single listings, and standard buyer coordination tools."}
                  </p>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <p className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">
                    Self-Service Upgrade
                  </p>
                  <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                    For testing and massive high-volume integrations, you can toggle between **Verified Seller** and **Professional Retailer** instantly.
                  </p>

                  <button
                    type="button"
                    onClick={handleToggleTier}
                    disabled={isUpgrading}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      user.isRetailer
                        ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                    }`}
                  >
                    {isUpgrading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {user.isRetailer ? "Downgrade to Standard" : "Upgrade to Pro Retailer"}
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Trust Box */}
            <div className="bg-[#141417] border border-white/5 rounded-[2rem] p-8 text-center space-y-4">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">eBay-Style Seller Protections</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                Our dynamic escrow system automatically protects sellers from fraudulent bids while maintaining a 100% transparency standard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
