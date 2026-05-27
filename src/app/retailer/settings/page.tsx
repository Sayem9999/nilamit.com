"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { updateRetailerSettings, toggleRetailerUpgrade } from "@/actions/retailer-settings";
import { updateProfile } from "@/actions/user";
import {
  Gavel,
  ShieldCheck,
  Building,
  MapPin,
  FileText,
  Smartphone,
  Sparkles,
  Loader2,
  CheckCircle,
  Camera,
  Trash2
} from "lucide-react";
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

  // Storefront Banner Photo Upload State
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isRemovingBanner, setIsRemovingBanner] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate form once session loads
  useEffect(() => {
     
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
     
  }, [session]);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const rawFile = files[0];
      setIsUploadingBanner(true);

      const { compressImage } = await import("@/lib/image-optimization");
      const { uploadFile } = await import("@/lib/uploadthing");

      const file = await compressImage(rawFile, { maxWidth: 1200, maxHeight: 400, quality: 0.85 });
      const publicUrl = await uploadFile(file, 'auction');

      const res = await updateProfile({ banner: publicUrl });
      if (res.success) {
        await update();
        toast.success("Storefront banner cover updated!");
      } else {
        toast.error(res.error?.message || "Failed to update banner");
      }
    } catch (error) {
      console.error("[Storefront Banner] Upload failed:", error);
      toast.error("Failed to upload banner. Please try again.");
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) {
        bannerFileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveBanner = async () => {
    if (!session?.user?.banner) return;
    try {
      setIsRemovingBanner(true);
      const res = await updateProfile({ banner: null });
      if (res.success) {
        await update();
        toast.success("Storefront banner cover removed.");
      } else {
        toast.error(res.error?.message || "Failed to remove banner");
      }
    } catch (error) {
      console.error("[Storefront Banner] Remove failed:", error);
      toast.error("Failed to remove storefront banner.");
    } finally {
      setIsRemovingBanner(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pt-36 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 font-heading">
                  Business Settings
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Manage payouts, storefront metadata, and seller tiers.
                </p>
              </div>
            </div>
            
            {/* Categorization Status */}
            <div className="flex items-center gap-3">
              <div className={`px-4 py-1.5 border rounded-full flex items-center gap-2 ${
                user.isRetailer
                  ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                  : "bg-blue-50 border-blue-100 text-blue-700"
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
              {/* Storefront Cover Banner Card */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 font-heading">
                  <Camera className="w-5 h-5 text-indigo-550" />
                  Billboard Cover Banner
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Upload a high-density storefront billboard banner. Resizes perfectly across web & mobile views.
                </p>

                <div 
                  onClick={() => !isUploadingBanner && !isRemovingBanner && bannerFileInputRef.current?.click()}
                  className="group relative w-full h-32 md:h-44 rounded-2xl bg-slate-50 border border-dashed border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer transition-all hover:border-indigo-500"
                >
                  <input
                    type="file"
                    ref={bannerFileInputRef}
                    onChange={handleBannerUpload}
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingBanner || isRemovingBanner}
                  />

                  {user.banner ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.banner}
                      alt="Storefront Banner"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-700 opacity-90 flex flex-col items-center justify-center p-4 text-center text-white">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-2">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-white">No Banner Uploaded</span>
                      <span className="text-[10px] text-white/80 mt-1">Click to upload custom cover photo (1200 x 400 suggested)</span>
                    </div>
                  )}

                  {/* Change photo hover overlay */}
                  {!isUploadingBanner && !isRemovingBanner && user.banner && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Camera className="w-6 h-6 text-white" />
                      <span className="text-xs font-black uppercase tracking-widest">Change Banner Image</span>
                    </div>
                  )}

                  {/* Uploading loading overlay */}
                  {(isUploadingBanner || isRemovingBanner) && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 text-white z-40">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">
                        {isRemovingBanner ? "Removing..." : "Uploading Banner..."}
                      </span>
                    </div>
                  )}
                </div>

                {user.banner && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      disabled={isRemovingBanner || isUploadingBanner}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-full transition-all border border-red-200"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove Banner
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Details Card */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 font-heading">
                  <Building className="w-5 h-5 text-indigo-550" />
                  Storefront Profile
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="businessName" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Business / Display Name
                    </label>
                    <input
                      id="businessName"
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Dhaka Electronics Hub"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="businessLocation" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Business Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        id="businessLocation"
                        type="text"
                        value={businessLocation}
                        onChange={(e) => setBusinessLocation(e.target.value)}
                        placeholder="e.g. Mirpur, Dhaka"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bio" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      About / Business Biography
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell buyers about your shop, shipping speed, and specialty..."
                        rows={4}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 placeholder-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* MFS Credentials Card */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 font-heading">
                  <Smartphone className="w-5 h-5 text-indigo-550" />
                  MFS Payment Credentials
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Provide verified bKash or Nagad numbers to receive automatic settlements upon escrow releases.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bkashNumber" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      bKash Personal Number
                    </label>
                    <input
                      id="bkashNumber"
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      placeholder="e.g. 017XXXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="nagadNumber" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Nagad Personal Number
                    </label>
                    <input
                      id="nagadNumber"
                      type="text"
                      value={nagadNumber}
                      onChange={(e) => setNagadNumber(e.target.value)}
                      placeholder="e.g. 019XXXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-4 bg-indigo-650 hover:bg-indigo-750 text-white disabled:bg-slate-200 disabled:text-slate-400 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-650/10 hover:shadow-lg"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {isPending ? "Saving..." : "Save Business Settings"}
              </button>
            </form>
          </div>

          {/* Sidebar Tier Upgrade Controller */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-550" />
                <h3 className="text-md font-bold text-slate-900 font-heading">Tier Control Center</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Current Level</p>
                  <p className="text-lg font-black text-slate-900 flex items-center gap-1.5 font-heading">
                    {user.isRetailer ? "Professional Retailer" : "Verified Seller"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-medium">
                    {user.isRetailer 
                      ? "Full access to high-volume bulk inventory sync, pro badges, and 0% escrow promotional fees."
                      : "Access to the standard Seller Hub, unlimited single listings, and standard buyer coordination tools."}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                    Self-Service Upgrade
                  </p>
                  <p className="text-[10px] text-slate-500 mb-4 leading-relaxed font-medium">
                    For testing and massive high-volume integrations, you can toggle between **Verified Seller** and **Professional Retailer** instantly.
                  </p>

                  <button
                    type="button"
                    onClick={handleToggleTier}
                    disabled={isUpgrading}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      user.isRetailer
                        ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
                        : "bg-indigo-650 hover:bg-indigo-750 text-white shadow-md shadow-indigo-650/10 hover:shadow-lg"
                    }`}
                  >
                    {isUpgrading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {user.isRetailer ? "Downgrade to Standard" : "Upgrade to Pro Retailer"}
                  </button>
                </div>
              </div>
            </div>

            {/* Platform Trust Box */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-8 text-center space-y-4 text-slate-800">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-heading">Standard Seller Protections</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                Our dynamic escrow system automatically protects sellers from fraudulent bids while maintaining a 100% transparency standard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
