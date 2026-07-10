"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateProfile, linkMFSAccount } from "@/actions/user";
import { toggleRetailerUpgrade } from "@/actions/retailer-settings";
import { getProxiedAvatarUrl } from "@/lib/avatar";
import { logoutAction } from "@/actions/auth";
import { sendMFSVerificationOTP } from "@/actions/otp";
import {
  User,
  Edit3,
  Save,
  MessageSquare,
  Wallet,
  Mail,
  BadgeCheck,
  ShieldCheck,
  Trophy,
  LogOut,
  Camera,
  Loader2,
  MapPin,
  Trash2,
} from "lucide-react";
import { ReviewList } from "@/components/review/ReviewList";
import TrustBadge from "@/components/social/TrustBadge";
import VerificationBadge from "@/components/social/VerificationBadge";
import { PhoneVerificationCard } from "@/components/verification/PhoneVerificationCard";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";

export default function ProfileSettings() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const t_prof = useTranslations("Profile");
  const t_nav = useTranslations("Navigation");
  const [isPending, startTransition] = useTransition();
  const [isUpgrading, startUpgradeTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  // Localized Address Book states
  const [addressStreet, setAddressStreet] = useState("");
  const [addressArea, setAddressArea] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  useEffect(() => {
    if (session?.user) {
      const u = session.user as {
        addressStreet?: string | null;
        addressArea?: string | null;
        addressDistrict?: string | null;
        addressZip?: string | null;
      };
      setAddressStreet(u.addressStreet || "");
      setAddressArea(u.addressArea || "");
      setAddressDistrict(u.addressDistrict || "");
      setAddressZip(u.addressZip || "");
    }
  }, [session]);

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    try {
      const res = await updateProfile({
        addressStreet: addressStreet.trim() || null,
        addressArea: addressArea.trim() || null,
        addressDistrict: addressDistrict.trim() || null,
        addressZip: addressZip.trim() || null,
      });
      if (res.success) {
        await update();
        setEditingAddress(false);
        toast.success("Delivery Address Book updated successfully!");
      } else {
        toast.error(res.error?.message || "Failed to update address.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update address.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Profile Photo Upload State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Banner Upload State
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isRemovingBanner, setIsRemovingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const rawFile = files[0];
      setIsUploadingPhoto(true);

      // Dynamically load image optimization and upload utilities
      const { compressImage } = await import("@/lib/image-optimization");
      const { uploadFile } = await import("@/lib/uploadthing");

      // Compress client-side for maximum bandwidth efficiency
      const file = await compressImage(rawFile, { maxWidth: 500, maxHeight: 500, quality: 0.85 });

      // Upload using secure server-side upload endpoint. 'profile' — NOT
      // 'auction': the auctions/ prefix is garbage-collected against auction
      // docs, which is what was silently deleting avatars after 7 days.
      const publicUrl = await uploadFile(file, 'profile');

      // Update database profile
      const res = await updateProfile({ image: publicUrl });
      if (res.success) {
        // Force NextAuth session refresh to sync the avatar instantly
        await update();
        toast.success("Profile photo updated!");
      } else {
        toast.error(res.error?.message || "Failed to update profile photo");
      }
    } catch (error) {
      console.error("[Profile Photo] Upload failed:", error);
      toast.error("Failed to upload profile photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!session?.user?.image) return;
    try {
      setIsRemovingPhoto(true);
      const res = await updateProfile({ image: null });
      if (res.success) {
        await update();
        toast.success("Profile photo removed.");
      } else {
        toast.error(res.error?.message || "Failed to remove photo");
      }
    } catch (error) {
      console.error("[Profile Photo] Remove failed:", error);
      toast.error("Failed to remove profile photo.");
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const rawFile = files[0];
      setIsUploadingBanner(true);

      // Dynamically load image optimization and upload utilities
      const { compressImage } = await import("@/lib/image-optimization");
      const { uploadFile } = await import("@/lib/uploadthing");

      // Compress client-side for maximum bandwidth efficiency (landscape aspect ratio)
      const file = await compressImage(rawFile, { maxWidth: 1200, maxHeight: 400, quality: 0.85 });

      // Upload using secure server-side upload endpoint ('profile' — see note
      // in handlePhotoUpload).
      const publicUrl = await uploadFile(file, 'profile');

      // Update database profile
      const res = await updateProfile({ banner: publicUrl });
      if (res.success) {
        await update();
        toast.success("Profile banner updated!");
      } else {
        toast.error(res.error?.message || "Failed to update profile banner");
      }
    } catch (error) {
      console.error("[Profile Banner] Upload failed:", error);
      toast.error("Failed to upload profile banner. Please try again.");
    } finally {
      setIsUploadingBanner(false);
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
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
        toast.success("Profile banner removed.");
      } else {
        toast.error(res.error?.message || "Failed to remove banner");
      }
    } catch (error) {
      console.error("[Profile Banner] Remove failed:", error);
      toast.error("Failed to remove profile banner.");
    } finally {
      setIsRemovingBanner(false);
    }
  };
  
  // MFS State
  const [bkash, setBkash] = useState("");
  const [nagad, setNagad] = useState("");
  const [bkashOtp, setBkashOtp] = useState("");
  const [nagadOtp, setNagadOtp] = useState("");
  const [showBkashOtp, setShowBkashOtp] = useState(false);
  const [showNagadOtp, setShowNagadOtp] = useState(false);
  
  const [isEmailVerifiedLocal, setIsEmailVerifiedLocal] = useState(false);

  const maskPhone = (num: string) => {
    if (!num) return "";
    if (num.startsWith('+88')) {
      return num.slice(0, 6) + "****" + num.slice(-4);
    }
    return num.slice(0, 3) + "****" + num.slice(-4);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (session?.user) {
      const u = session.user as { emailVerified?: unknown };
       
      const isVerified = u.emailVerified != null;
      if (isVerified) {
        setIsEmailVerifiedLocal(true);
      }

      if (!isVerified && !isEmailVerifiedLocal) {
        const syncFirebaseEmail = async () => {
          try {
            const { ensureFirebaseAuth, getClientAuth } = await import("@/lib/firebase-client");
            await ensureFirebaseAuth();
            const auth = getClientAuth();
            if (auth.currentUser) {
              await auth.currentUser.reload();
              if (auth.currentUser.emailVerified) {
                const { markEmailVerifiedNatively } = await import("@/actions/email");
                const res = await markEmailVerifiedNatively();
                if (res.success) {
                  setIsEmailVerifiedLocal(true);
                  await update();
                }
              }
            }
          } catch (e) {
            console.error("[Profile Sync] Failed to check Firebase native verification:", e);
          }
        };
        syncFirebaseEmail();
      }
    }
  }, [status, router, session, update, isEmailVerifiedLocal]);

  // Local SVG assets for robust cross-domain loading and full CSP/hotlink bypass
  const BKASH_LOGO_PRIMARY = "/bkash.svg";
  const NAGAD_LOGO_PRIMARY = "/nagad.svg";

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full shadow-sm" 
        />
      </div>
    );
  }

  if (!session) return null;

  const user = (session.user as unknown) as { 
    id: string; 
    isVerifiedSeller: boolean; 
    isRetailer: boolean;
    rating: number; 
    ratingCount: number;
    reputationScore: number;
    email?: string;
    emailVerified?: Date | string | null;
    bkashNumber?: string;
    nagadNumber?: string;
    xp: number;
    userLevel: number;
    winningStreak: number;
    salesCount?: number;
    defectCount?: number;
    addressStreet?: string | null;
    addressArea?: string | null;
    addressDistrict?: string | null;
    addressZip?: string | null;
    defaultPayout?: string | null;
  };

  const handleSaveName = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateProfile({ name });
      await update();
      setEditing(false);
      setName("");
      toast.success("Profile name updated successfully!");
    });
  };

  const handleToggleTier = () => {
    const nextStatus = !user.isRetailer;
    startUpgradeTransition(async () => {
      const res = await toggleRetailerUpgrade(nextStatus);
      if (res.success) {
        toast.success(
          nextStatus 
            ? "Switched to Professional Retailer! Advanced tools are now unlocked."
            : "Switched to standard Seller / Bidder."
        );
        await update(); // Sync NextAuth session
        window.location.reload(); // Force page reload to ensure state syncs instantly
      } else {
        toast.error(res.error?.message || "Failed to switch role category.");
      }
    });
  };

  const handleSendMFSOTP = (type: 'bkash' | 'nagad', number: string) => {
    setMsg("");
    startTransition(async () => {
      try {
        const res = await sendMFSVerificationOTP(type, number);
        if (res.success) {
          const isFallback = !!res.data?.fallbackEmail;
          if (type === 'bkash') {
            setShowBkashOtp(true);
          } else {
            setShowNagadOtp(true);
          }
          const infoMsg = isFallback
            ? "We sent a secure code to your verified email address as an SMS fallback."
            : "Verification code sent to your phone number.";
          setMsg(infoMsg);
          toast.success(infoMsg);
        } else {
          const errMsg = res.error?.message || "Failed to send verification code.";
          setMsg(errMsg);
          toast.error(errMsg);
        }
      } catch (err) {
        console.error(`[MFS OTP] Send failed for ${type}:`, err);
        toast.error("Failed to send verification code.");
      }
    });
  };

  const handleVerifyMFSOTP = (type: 'bkash' | 'nagad', number: string, otp: string) => {
    setMsg("");
    startTransition(async () => {
      try {
        const res = await linkMFSAccount(type, number, otp);
        if (res.success) {
          const successMsg = type === 'bkash' ? t_prof("bkashSuccess") : t_prof("nagadSuccess");
          setMsg(successMsg);
          toast.success(successMsg);
          if (type === 'bkash') {
            setShowBkashOtp(false);
            setBkashOtp("");
          } else {
            setShowNagadOtp(false);
            setNagadOtp("");
          }
          await update();
        } else {
          const errMsg = res.error?.message || t_prof("errorGeneric");
          setMsg(errMsg);
          toast.error(errMsg);
        }
      } catch (err) {
        console.error(`[MFS Verify] Link failed for ${type}:`, err);
        toast.error("Failed to link account.");
      }
    });
  };

  const handleSendEmailVerification = () => {
    setMsg("");
    startTransition(async () => {
      try {
        const { sendNativeVerificationEmail } = await import("@/lib/firebase-client");
        await sendNativeVerificationEmail();
        const emailMsg = t_prof("emailVerificationSent");
        setMsg(emailMsg);
        toast.success(emailMsg);
      } catch (err: unknown) {
        console.error("sendNativeVerificationEmail failed:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setMsg(errMsg || t_prof("errorGeneric"));
        toast.error(errMsg || t_prof("errorGeneric"));
      }
    });
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3,
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Premium Compact Header Card */}
      <div className="relative p-8 rounded-md text-white overflow-hidden shadow-xl mb-8 min-h-[160px] flex items-center">
        {session.user?.banner ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session.user.banner}
              alt="Profile Banner"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-800" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[80px] -mr-32 -mt-32" />
          </>
        )}
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between w-full">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
            <div className="relative group cursor-pointer" onClick={() => !isUploadingPhoto && !isRemovingPhoto && fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
                disabled={isUploadingPhoto || isRemovingPhoto}
              />
              <div className="relative w-24 h-24 overflow-hidden rounded-full bg-white/10 ring-4 ring-white/20 shadow-lg">
                {session.user?.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={getProxiedAvatarUrl(session.user.image) || ""}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <User size={40} strokeWidth={1} />
                  </div>
                )}
                
                {/* Uploading loading overlay */}
                {(isUploadingPhoto || isRemovingPhoto) && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 text-white z-40">
                    <Loader2 size={16} className="animate-spin text-primary-400" />
                  </div>
                )}

                {/* Change photo hover overlay */}
                {!isUploadingPhoto && !isRemovingPhoto && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Camera size={16} className="text-white" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow border border-gray-100 z-30">
                <VerificationBadge
                  emailVerified={isEmailVerifiedLocal ? new Date() : null}
                  isVerifiedSeller={!!(user as { isVerifiedSeller?: boolean }).isVerifiedSeller}
                  size="md"
                />
              </div>
            </div>
            
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{session.user?.name}</h1>
                {user.userLevel > 5 && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-[11px] font-bold text-white uppercase tracking-wider mx-auto md:mx-0">
                    <Trophy size={10} className="text-amber-400" /> {t_prof("eliteMember") || "Elite"}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-1 text-xs text-primary-100 font-medium">
                <Mail size={12} />
                <span>{session.user?.email}</span>
                {isEmailVerifiedLocal && <BadgeCheck size={12} className="text-emerald-400 fill-emerald-950/20" />}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 relative z-20">
            {/* Photo controls */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto || isRemovingPhoto || isUploadingBanner || isRemovingBanner}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white text-[11px] font-bold uppercase tracking-wide rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
            >
              {isUploadingPhoto ? (
                <Loader2 size={12} className="animate-spin text-white" />
              ) : (
                <Camera size={12} className="text-white" />
              )}
              {session.user?.image ? "Change Photo" : "Upload Photo"}
            </button>

            {session.user?.image && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isRemovingPhoto || isUploadingPhoto || isUploadingBanner || isRemovingBanner}
                className="px-4 py-2.5 bg-white/10 hover:bg-red-500/25 border border-white/10 hover:border-transparent text-white text-[11px] font-bold uppercase tracking-wide rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
              >
                {isRemovingPhoto ? (
                  <Loader2 size={12} className="animate-spin text-white" />
                ) : (
                  <Trash2 size={12} className="text-white" />
                )}
                Remove Photo
              </button>
            )}

            {/* Banner controls */}
            <input
              type="file"
              ref={bannerInputRef}
              onChange={handleBannerUpload}
              accept="image/*"
              className="hidden"
              disabled={isUploadingBanner || isRemovingBanner}
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner || isRemovingBanner || isUploadingPhoto || isRemovingPhoto}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white text-[11px] font-bold uppercase tracking-wide rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
            >
              {isUploadingBanner ? (
                <Loader2 size={12} className="animate-spin text-white" />
              ) : (
                <Camera size={12} className="text-white" />
              )}
              {session.user?.banner ? "Change Banner" : "Upload Banner"}
            </button>

            {session.user?.banner && (
              <button
                type="button"
                onClick={handleRemoveBanner}
                disabled={isRemovingBanner || isUploadingBanner || isUploadingPhoto || isRemovingPhoto}
                className="px-4 py-2.5 bg-white/10 hover:bg-red-500/25 border border-white/10 hover:border-transparent text-white text-[11px] font-bold uppercase tracking-wide rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
              >
                {isRemovingBanner ? (
                  <Loader2 size={12} className="animate-spin text-white" />
                ) : (
                  <Trash2 size={12} className="text-white" />
                )}
                Remove Banner
              </button>
            )}
            
            <button 
              onClick={async () => {
                try {
                  await signOut({ callbackUrl: "/login", redirect: true });
                } catch (e) {
                  console.error("SignOut failed, redirecting manually", e);
                  try {
                    await logoutAction();
                    window.location.href = "/login";
                  } catch {
                    window.location.href = "/api/auth/signout?callbackUrl=/login";
                  }
                }
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-red-600 hover:bg-red-50 rounded-md text-[11px] font-bold uppercase tracking-wide transition-all shadow-md active:scale-95"
            >
              <LogOut size={12} /> 
              {t_nav("signout")}
            </button>
          </div>
        </div>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
           <div className="bg-white p-5 rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center sm:text-left">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Trades Done</p>
              <p className="text-xl font-bold text-gray-900 leading-tight">
                {user.salesCount || 0} <span className="text-[11px] text-gray-400 font-medium">Trades</span>
              </p>
           </div>

           <div className="bg-white p-5 rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center sm:text-left">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Feedback Score</p>
              <p className="text-xl font-bold text-gray-900 leading-tight">
                {Number(user.rating || 0).toFixed(1)} <span className="text-[11px] text-gray-400 font-medium">/ 5.0</span>
              </p>
           </div>

           <div className="bg-white p-5 rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center sm:text-left">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Reputation Score</p>
              <p className="text-xl font-bold text-gray-900 leading-tight">
                {user.reputationScore || 0}
              </p>
           </div>

           <div className="bg-white p-5 rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center sm:text-left">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Trader Level</p>
              <p className="text-xl font-bold text-gray-900 leading-tight">
                Lv. {user.userLevel || 1}
              </p>
           </div>
        </motion.div>

        {/* Form Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Block */}
          <div className="space-y-6">
            
            {/* Verification Alert banner */}
            {!isEmailVerifiedLocal && (
              <motion.div 
                variants={itemVariants}
                className="bg-blue-50 border border-blue-200 rounded-md p-6 shadow-sm relative overflow-hidden"
              >
                <div className="relative z-10 flex items-start gap-4">
                  <div className="p-2 bg-white rounded-md text-blue-600">
                    <Mail size={16} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-0.5">
                      Verify Your Email Address
                    </h3>
                    <p className="text-[11px] text-blue-800/80 font-medium mb-3 leading-relaxed">
                      Confirm your email to enable official billing notices and fast coordination.
                    </p>
                    <button
                      onClick={handleSendEmailVerification}
                      disabled={isPending}
                      className="w-full bg-blue-600 text-white py-2 rounded-md font-bold text-[11px] uppercase tracking-wide hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isPending ? "Sending..." : "Send Verification Link"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Profile Info Details */}
            <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <User size={18} className="text-primary-600" /> Account Identity
                </h3>
                {!editing && (
                  <button 
                    onClick={() => setEditing(true)}
                    className="p-2 bg-gray-50 text-gray-600 rounded-md hover:bg-primary-50 hover:text-primary-600 transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="profile-fullname" className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Full Name</label>
                  {editing ? (
                    <div className="flex gap-2">
                      <input
                        id="profile-fullname"
                        type="text"
                        autoComplete="name"
                        value={name}
                        placeholder={session.user?.name || ""}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveName}
                        disabled={isPending}
                        className="bg-primary-600 text-white px-4 rounded-md hover:bg-primary-700 transition-all disabled:opacity-50"
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-bold text-sm">{session.user?.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Email Address</label>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <span>{session.user?.email}</span>
                    {isEmailVerifiedLocal ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-50 text-green-700 text-[11px] font-bold rounded-full border border-green-200">
                        VERIFIED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-full border border-amber-200">
                        UNVERIFIED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Upgrade/Switcher Card */}
            <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-primary-600" /> Account Class
                </h3>
                <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                  user.isRetailer 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    : 'bg-primary-50 text-primary-700 border-primary-100'
                }`}>
                  {user.isRetailer ? "Pro Retailer" : "Standard"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                Standard accounts can list and bid freely. **Professional Retailer** accounts unlock discounted commission rates and premium merchant profiles.
              </p>
              <button
                type="button"
                onClick={handleToggleTier}
                disabled={isUpgrading}
                className={`w-full py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  user.isRetailer
                    ? "bg-red-500/10 border border-red-200 text-red-600 hover:bg-red-500/20"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10"
                }`}
              >
                {isUpgrading && <Loader2 size={12} className="animate-spin" />}
                {user.isRetailer ? "Downgrade to Standard Trader" : "Upgrade to Pro Retailer"}
              </button>
            </div>

          </div>

          {/* Right Block */}
          <div className="space-y-6">

            {/* Address Book Card */}
            <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <MapPin size={18} className="text-primary-600" /> Shipping Address
                </h3>
                {!editingAddress && (
                  <button 
                    onClick={() => setEditingAddress(true)}
                    className="text-[11px] font-bold uppercase tracking-wide text-primary-650 hover:text-primary-850"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingAddress ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="address-street" className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-0.5">Street Address</label>
                    <input 
                      id="address-street"
                      type="text"
                      placeholder="e.g., Road 11, House 24"
                      value={addressStreet}
                      onChange={(e) => setAddressStreet(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label htmlFor="address-area" className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-0.5">Area / Neighborhood</label>
                      <input 
                        id="address-area"
                        type="text"
                        placeholder="e.g., Dhanmondi"
                        value={addressArea}
                        onChange={(e) => setAddressArea(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="address-zip" className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-0.5">Zip Code</label>
                      <input 
                        id="address-zip"
                        type="text"
                        placeholder="1209"
                        value={addressZip}
                        onChange={(e) => setAddressZip(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="address-district" className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-0.5">District / City</label>
                    <select
                      id="address-district"
                      value={addressDistrict}
                      onChange={(e) => setAddressDistrict(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select District</option>
                      <option value="Dhaka">Dhaka</option>
                      <option value="Chattogram">Chattogram</option>
                      <option value="Sylhet">Sylhet</option>
                      <option value="Khulna">Khulna</option>
                      <option value="Rajshahi">Rajshahi</option>
                      <option value="Barishal">Barishal</option>
                      <option value="Rangpur">Rangpur</option>
                      <option value="Mymensingh">Mymensingh</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveAddress}
                      disabled={isSavingAddress}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wide transition-all disabled:opacity-40"
                    >
                      {isSavingAddress ? "Saving..." : "Save Address"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(false);
                        if (session?.user) {
                          const u = session.user as {
                            addressStreet?: string | null;
                            addressArea?: string | null;
                            addressDistrict?: string | null;
                            addressZip?: string | null;
                          };
                          setAddressStreet(u.addressStreet || "");
                          setAddressArea(u.addressArea || "");
                          setAddressDistrict(u.addressDistrict || "");
                          setAddressZip(u.addressZip || "");
                        }
                      }}
                      disabled={isSavingAddress}
                      className="px-4 bg-gray-100 text-gray-700 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wide hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-1">
                  {addressStreet || addressArea || addressDistrict ? (
                    <div className="space-y-1.5 bg-slate-50/50 p-4 rounded-md border border-slate-100 text-xs font-bold text-slate-800">
                      <p className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider">Default Destination</p>
                      <p className="text-sm font-bold text-slate-900">{addressStreet}</p>
                      <p className="text-slate-600">{addressArea}, {addressDistrict} {addressZip && ` - ${addressZip}`}</p>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50/50 rounded-md border border-dashed border-slate-200 text-center">
                      <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-[200px] mx-auto">
                        No address configured. Configure a default shipping location to auto-coordinate won auctions.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phone Verification (Firebase SMS OTP) */}
            <PhoneVerificationCard />

            {/* MFS Verification Card */}
            <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Wallet size={18} className="text-primary-600" /> Wallet Verification
              </h3>

              <div className="space-y-4">
                {/* bKash Widget */}
                <div className={`p-4 rounded-md border transition-all ${user.bkashNumber ? 'bg-gradient-to-br from-white to-pink-50/10 border-pink-100' : 'bg-[#E2125D]/5 border-[#E2125D]/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center p-1 border border-pink-100/50">
                      <Image src={BKASH_LOGO_PRIMARY} alt="bKash" width={32} height={32} className="object-contain" />
                    </div>
                    {user.bkashNumber ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-50 text-green-700 text-[11px] font-bold rounded-full border border-green-200">
                        LINKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-50 text-gray-500 text-[11px] font-bold rounded-full border border-gray-200">
                        UNLINKED
                      </span>
                    )}
                  </div>
                  
                  {user.bkashNumber ? (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-gray-900 font-mono tracking-wider">{maskPhone(user.bkashNumber)}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {!showBkashOtp ? (
                        <>
                          <input
                            type="tel"
                            maxLength={11}
                            placeholder="01XXXXXXXXX"
                            value={bkash}
                            onChange={(e) => setBkash(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white border border-[#E2125D]/20 rounded-md px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#E2125D]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendMFSOTP('bkash', bkash)}
                            disabled={isPending || bkash.length < 11}
                            className="w-full bg-[#E2125D] text-white py-2 rounded-md text-[11px] font-bold uppercase tracking-wide disabled:opacity-30"
                          >
                            Link bKash Account
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit code"
                            value={bkashOtp}
                            onChange={(e) => setBkashOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white border border-[#E2125D]/20 rounded-md px-4 py-2.5 text-xs font-bold font-mono tracking-wide text-center outline-none focus:ring-2 focus:ring-[#E2125D]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerifyMFSOTP('bkash', bkash, bkashOtp)}
                              disabled={isPending || bkashOtp.length !== 6}
                              className="flex-1 bg-[#E2125D] text-white py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wide disabled:opacity-30"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowBkashOtp(false);
                                setBkashOtp("");
                              }}
                              className="px-3 bg-gray-100 text-gray-700 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wide hover:bg-gray-200 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Nagad Widget */}
                <div className={`p-4 rounded-md border transition-all ${user.nagadNumber ? 'bg-gradient-to-br from-white to-orange-50/10 border-orange-100' : 'bg-[#F69320]/5 border-[#F69320]/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center p-1 border border-orange-100/50">
                      <Image src={NAGAD_LOGO_PRIMARY} alt="Nagad" width={32} height={32} className="object-contain" />
                    </div>
                    {user.nagadNumber ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-50 text-green-700 text-[11px] font-bold rounded-full border border-green-200">
                        LINKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-50 text-gray-500 text-[11px] font-bold rounded-full border border-gray-200">
                        UNLINKED
                      </span>
                    )}
                  </div>
                  
                  {user.nagadNumber ? (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-gray-900 font-mono tracking-wider">{maskPhone(user.nagadNumber)}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {!showNagadOtp ? (
                        <>
                          <input
                            type="tel"
                            maxLength={11}
                            placeholder="01XXXXXXXXX"
                            value={nagad}
                            onChange={(e) => setNagad(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white border border-[#F69320]/20 rounded-md px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#F69320]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendMFSOTP('nagad', nagad)}
                            disabled={isPending || nagad.length < 11}
                            className="w-full bg-[#F69320] text-white py-2 rounded-md text-[11px] font-bold uppercase tracking-wide disabled:opacity-30"
                          >
                            Link Nagad Account
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit code"
                            value={nagadOtp}
                            onChange={(e) => setNagadOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-white border border-[#F69320]/20 rounded-md px-4 py-2.5 text-xs font-bold font-mono tracking-wide text-center outline-none focus:ring-2 focus:ring-[#F69320]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerifyMFSOTP('nagad', nagad, nagadOtp)}
                              disabled={isPending || nagadOtp.length !== 6}
                              className="flex-1 bg-[#F69320] text-white py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wide disabled:opacity-30"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNagadOtp(false);
                                setNagadOtp("");
                              }}
                              className="px-3 bg-gray-100 text-gray-700 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wide hover:bg-gray-200 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {msg && (
                  <motion.p 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`text-[11px] font-bold px-3 py-2 rounded-md border ${msg.toLowerCase().includes("success") || msg.toLowerCase().includes("linked") ? "bg-green-50 text-green-700 border-green-150" : "bg-red-50 text-red-600 border-red-150"}`}
                  >
                    {msg}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>

        {/* Dynamic Reviews Section */}
        <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-primary-600" /> Community Feedback Ledger
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 border-r border-gray-100 pr-6 flex flex-col justify-center">
              <TrustBadge 
                rating={(user?.rating as number) || 3.5} 
                ratingCount={(user?.ratingCount as number) || 0}
                size="lg"
              />
            </div>
            <div className="md:col-span-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <ReviewList userId={session.user?.id || ""} />
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
