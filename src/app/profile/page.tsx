"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateProfile, linkMFSAccount } from "@/actions/user";
import { logoutAction } from "@/actions/auth";
import { sendPhoneOTP, verifyPhoneOTP } from "@/actions/phone";
import { calculateLevelProgress } from "@/lib/gamification-engine";
import {
  User,
  Phone,
  Edit3,
  Save,
  Star,
  MessageSquare,
  Wallet,
  Mail,
  Smartphone,
  BadgeCheck,
  ChevronRight,
  ShieldCheck,
  Zap,
  Trophy,
  Activity,
  LogOut,
} from "lucide-react";
import { ReviewList } from "@/components/review/ReviewList";
import TrustBadge from "@/components/social/TrustBadge";
import VerificationBadge from "@/components/social/VerificationBadge";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";

export default function ProfilePage() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const t_prof = useTranslations("Profile");
  const t_nav = useTranslations("Navigation");
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phoneStep, setPhoneStep] = useState<"idle" | "input" | "otp">("idle");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  
  // MFS State
  const [bkash, setBkash] = useState("");
  const [nagad, setNagad] = useState("");
  
  // Instant Visibility State
  const [isPhoneVerifiedLocal, setIsPhoneVerifiedLocal] = useState(false);
  const [isEmailVerifiedLocal, setIsEmailVerifiedLocal] = useState(false);

  const maskPhone = (num: string) => {
    if (!num) return "";
    return num.slice(0, 3) + "****" + num.slice(-4);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (session?.user) {
      // Mirror session-derived flags into local state so an OTP-verify action
      // can optimistically flip them before the session refresh propagates
      // (see line ~150 — setIsPhoneVerifiedLocal(true) on success).
      const u = session.user as { isPhoneVerified?: boolean; emailVerified?: unknown };
       
      setIsPhoneVerifiedLocal(u.isPhoneVerified === true);
       
      const isVerified = u.emailVerified != null;
      setIsEmailVerifiedLocal(isVerified);

      if (!isVerified) {
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
  }, [status, router, session, update]);

  // Local SVG assets for robust cross-domain loading and full CSP/hotlink bypass
  const BKASH_LOGO_PRIMARY = "/bkash.svg";
  const NAGAD_LOGO_PRIMARY = "/nagad.svg";

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full shadow-sm" 
        />
      </div>
    );
  }

  if (!session) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (session.user as any) as { 
    id: string; 
    isPhoneVerified: boolean; 
    rating: number; 
    ratingCount: number;
    phone?: string; 
    email?: string;
    emailVerified?: Date | string | null;
    bkashNumber?: string;
    nagadNumber?: string;
    xp: number;
    userLevel: number;
    winningStreak: number;
  };

  const handleSaveName = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateProfile({ name });
      await update();
      setEditing(false);
      setName("");
    });
  };

  const handleLinkMFS = (type: 'bkash' | 'nagad', number: string) => {
    setMsg("");
    startTransition(async () => {
      const res = await linkMFSAccount(type, number);
      if (res.success) {
        setMsg(type === 'bkash' ? t_prof("bkashSuccess") : t_prof("nagadSuccess"));
        await update();
      } else {
        setMsg(res.error?.message || t_prof("errorGeneric"));
      }
    });
  };

  const handleSendOTP = () => {
    setMsg("");
    startTransition(async () => {
      const res = await sendPhoneOTP(phone);
      if (res.success) {
        setPhoneStep("otp");
        setMsg(t_prof("otpSent"));
      } else {
        setMsg(res.error?.message || t_prof("errorGeneric"));
      }
    });
  };

  const handleVerifyOTP = () => {
    setMsg("");
    startTransition(async () => {
      const res = await verifyPhoneOTP(phone, otp);
      if (res.success) {
        setPhoneStep("idle");
        setIsPhoneVerifiedLocal(true);
        setMsg(t_prof("verificationSuccess"));
        await update();
      } else {
        setMsg(res.error?.message || t_prof("errorGeneric"));
      }
    });
  };

  const handleSendEmailVerification = () => {
    setMsg("");
    startTransition(async () => {
      try {
        const { ensureFirebaseAuth, getClientAuth } = await import("@/lib/firebase-client");
        await ensureFirebaseAuth();
        const auth = getClientAuth();
        if (!auth.currentUser) {
          setMsg(t_prof("errorGeneric"));
          return;
        }

        const { sendEmailVerification: sendFirebaseEmailVerification } = await import("firebase/auth");
        await sendFirebaseEmailVerification(auth.currentUser);
        setMsg(t_prof("emailVerificationSent"));
      } catch (err: unknown) {
        console.error("Firebase sendEmailVerification failed:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setMsg(errMsg || t_prof("errorGeneric"));
      }
    });
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Premium Header/Cover Area with Mesh Gradient */}
      <div className="relative h-72 md:h-80 bg-primary-600 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-800" />
        <div className="absolute inset-0 opacity-10" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm52-70c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM9 32c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm53 17c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM8 46c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm91-10c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zM40 52c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm7 0c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm14-27c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm11 5c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-1 30c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-13 14c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-2 10c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-10-2c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-15-2c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-8-31c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm0-1c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E")` }} 
        />
        
        {/* Floating Abstract Shapes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/30 rounded-full blur-[100px] -ml-32 -mb-32" />
        
        <div className="max-w-5xl mx-auto px-4 h-full relative flex items-end pb-16 md:pb-24">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 w-full translate-y-2 md:translate-y-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative p-1.5 bg-white rounded-full shadow-2xl z-20"
            >
              <div className="relative overflow-hidden rounded-full bg-gray-100 ring-4 ring-white shadow-inner">
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    width={160}
                    height={160}
                    className="w-32 h-32 md:w-40 md:h-40 object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center text-primary-600">
                    <User size={64} strokeWidth={1} />
                  </div>
                )}
              </div>
              <div className="absolute bottom-1 right-1 p-1.5 bg-white rounded-full shadow-lg border border-gray-100 z-30">
                <VerificationBadge
                  isPhoneVerified={isPhoneVerifiedLocal}
                  emailVerified={isEmailVerifiedLocal ? new Date() : null}
                  isVerifiedSeller={!!(user as { isVerifiedSeller?: boolean }).isVerifiedSeller}
                  size="lg"
                />
              </div>
            </motion.div>

            <div className="flex-1 pb-4 text-center md:text-left z-10">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4"
              >
                <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-sm">
                  {session.user?.name}
                </h1>
                {user.userLevel > 5 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-[10px] font-black text-white uppercase tracking-wider mx-auto md:mx-0">
                    <Trophy size={12} className="text-amber-400" /> {t_prof("eliteMember") || "Elite Member"}
                  </div>
                )}
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-center md:justify-start gap-3 mt-2"
              >
                <div className="flex items-center gap-1.5 text-primary-100 font-bold text-sm bg-black/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                  <Mail size={14} />
                  <span>{session.user?.email}</span>
                  {isEmailVerifiedLocal && <BadgeCheck size={14} className="text-emerald-400 fill-emerald-950/20" />}
                </div>
                {user.phone && (
                  <div className="flex items-center gap-1.5 text-primary-100 font-bold text-sm bg-black/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                    <Smartphone size={14} />
                    <span>{maskPhone(user.phone)}</span>
                    {isPhoneVerifiedLocal && <BadgeCheck size={14} className="text-emerald-400 fill-emerald-950/20" />}
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="pb-6"
            >
              <button 
                onClick={async () => {
                  try {
                    await signOut({ 
                      callbackUrl: "/login",
                      redirect: true 
                    });
                  } catch (e) {
                    console.error("Client-side SignOut failed, trying Server Action", e);
                    try {
                      await logoutAction();
                      window.location.href = "/login";
                    } catch (e2) {
                      console.error("Server-side logout failed, trying hard redirect", e2);
                      window.location.href = "/api/auth/signout?callbackUrl=/login";
                    }
                  }
                }}
                className="group flex items-center gap-2 px-6 py-3 bg-white hover:bg-red-50 border border-transparent rounded-[1.5rem] text-sm font-black text-red-600 transition-all shadow-xl hover:shadow-red-500/10 active:scale-95"
              >
                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" /> 
                {t_nav("signout")}
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-5xl mx-auto px-4 mt-16 pb-20"
      >
        {/* Visionary Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Star className="text-primary-600 w-6 h-6 fill-primary-600/20" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t_prof("reputation") || "Reputation"}</p>
              <p className="text-2xl font-black text-gray-900 leading-tight">
                {((user?.rating as number) || 3.5).toFixed(1)} <span className="text-xs text-gray-400 font-medium">/ 5.0</span>
              </p>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="text-purple-600 w-6 h-6 fill-purple-600/20" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t_prof("level") || "Level"}</p>
              <p className="text-2xl font-black text-gray-900 leading-tight">
                {user.userLevel || 1} <span className="text-xs text-gray-400 font-medium tracking-tight">Rank</span>
              </p>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="text-orange-600 w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t_prof("xpPoints") || "XP Points"}</p>
              <p className="text-2xl font-black text-gray-900 leading-tight">
                {user.xp || 0} <span className="text-xs text-gray-400 font-medium tracking-tight">XP</span>
              </p>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Trophy className="text-blue-600 w-6 h-6 fill-blue-600/20" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t_prof("winningStreak") || "Win Streak"}</p>
              <p className="text-2xl font-black text-gray-900 leading-tight">
                {user.winningStreak || 0} <span className="text-xs text-gray-400 font-medium tracking-tight">Wins</span>
              </p>
           </div>
        </motion.div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
          
          {/* Left Column: Account & Verification */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Essential Action: Phone & Email Verification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isPhoneVerifiedLocal && (
                <motion.div 
                  variants={itemVariants}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, height: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/20 rounded-full blur-2xl -mr-12 -mt-12" />
                  <div className="relative z-10">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-2.5 bg-white rounded-xl shadow-sm text-amber-600">
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">
                          Phone Required
                        </h3>
                        <p className="text-[11px] text-amber-800/80 font-medium">
                          {t_prof("identityDesc")}
                        </p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {phoneStep === "idle" && (
                        <motion.button
                          key="idle"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onClick={() => setPhoneStep("input")}
                          className="w-full bg-amber-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {t_prof("startVerification")} <ChevronRight size={14} />
                        </motion.button>
                      )}

                      {phoneStep === "input" && (
                        <motion.div 
                          key="input"
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-3"
                        >
                          <label htmlFor="profile-phone" className="sr-only">{t_prof("phoneNumber")}</label>
                          <input
                            id="profile-phone"
                            type="tel"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+8801XXXXXXXXX"
                            className="w-full bg-white border border-amber-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-500 transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleSendOTP}
                            disabled={isPending || phone.length < 11}
                            className="w-full bg-amber-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                          >
                            {isPending ? "Sending..." : t_prof("sendOTP")}
                          </button>
                        </motion.div>
                      )}

                      {phoneStep === "otp" && (
                        <motion.div
                          key="otp"
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-3"
                        >
                          <label htmlFor="profile-otp" className="sr-only">6-digit verification code</label>
                          <input
                            id="profile-otp"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="OTP"
                            aria-label="6-digit verification code"
                            className="w-full bg-white border border-amber-100 rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest text-gray-900 outline-none focus:border-amber-500"
                          />
                          <button
                            onClick={handleVerifyOTP}
                            disabled={isPending || otp.length < 6}
                            className="w-full bg-green-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                          >
                            {isPending ? "Verifying..." : t_prof("verifyUnlock")}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {!isEmailVerifiedLocal && (
                <motion.div 
                  variants={itemVariants}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, height: 0 }}
                  className="bg-blue-50 border border-blue-200 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full blur-2xl -mr-12 -mt-12" />
                  <div className="relative z-10">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-2.5 bg-white rounded-xl shadow-sm text-blue-600">
                        <Mail size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-blue-900 uppercase tracking-tight">
                          Email Verification
                        </h3>
                        <p className="text-[11px] text-blue-800/80 font-medium">
                          Verify your email to receive official invoices and receipts.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleSendEmailVerification}
                      disabled={isPending}
                      className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {isPending ? "Sending..." : "Send Verification Link"} <Mail size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Profile Information */}
            <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <User size={22} className="text-primary-600" /> {t_prof("personalDetails") || "Personal Details"}
                </h3>
                {!editing && (
                  <button 
                    onClick={() => setEditing(true)}
                    className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all"
                  >
                    <Edit3 size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label htmlFor="profile-fullname" className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t_prof("fullName") || "Full Name"}</label>
                  {editing ? (
                    <div className="flex gap-2">
                      <input
                        id="profile-fullname"
                        type="text"
                        autoComplete="name"
                        value={name}
                        placeholder={session.user?.name || ""}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveName}
                        disabled={isPending}
                        aria-label="Save name"
                        className="bg-primary-600 text-white px-5 rounded-2xl hover:bg-primary-700 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        <Save size={20} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-bold text-lg">{session.user?.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t_prof("emailAddress") || "Email Address"}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-gray-700 font-bold">
                        <Mail size={16} className="text-primary-400" />
                        <span>{session.user?.email}</span>
                      </div>
                      {isEmailVerifiedLocal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-200 shadow-sm">
                          <BadgeCheck size={12} className="text-green-600 fill-green-600/10" />
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-200 shadow-sm">
                          UNVERIFIED
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t_prof("phoneNumber") || "Phone Number"}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-gray-700 font-bold">
                        <Phone size={16} className="text-primary-400" />
                        <span>{user.phone ? maskPhone(user.phone) : (t_prof("notVerified") || "Not Verified")}</span>
                      </div>
                      {user.phone && (
                        isPhoneVerifiedLocal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-200 shadow-sm">
                            <BadgeCheck size={12} className="text-green-600 fill-green-600/10" />
                            VERIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-200 shadow-sm">
                            UNVERIFIED
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* MFS Linkage - Mobile First Cards */}
            <motion.div variants={itemVariants} className="space-y-4">
               <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 pl-2">
                  <Wallet size={22} className="text-primary-600" /> {t_prof("mfsTitle")}
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* bKash Card */}
                  <div className={`p-6 rounded-[2.5rem] border transition-all ${user.bkashNumber ? 'bg-gradient-to-br from-white to-pink-50/10 border-pink-100 shadow-sm' : 'bg-[#E2125D]/5 border-[#E2125D]/10'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center p-2 border border-pink-100/50">
                        <Image 
                          src={BKASH_LOGO_PRIMARY} 
                          alt="bKash" 
                          width={48} 
                          height={48} 
                          className="object-contain" 
                        />
                      </div>
                      {user.bkashNumber ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-200 shadow-sm">
                          <BadgeCheck className="text-green-600 fill-green-600/10" size={14} />
                          ACTIVE LINK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-black rounded-full border border-gray-200">
                          UNLINKED
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">bKash Account</p>
                    {user.bkashNumber ? (
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xl font-black text-gray-900 font-mono tracking-wider">{maskPhone(user.bkashNumber)}</p>
                        <span className="text-xs text-green-600 font-black flex items-center gap-1">
                          <ShieldCheck size={14} /> Linked
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label htmlFor="profile-bkash" className="sr-only">bKash account number</label>
                        <input
                          id="profile-bkash"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={14}
                          autoComplete="off"
                          placeholder="01XXXXXXXXX"
                          value={bkash}
                          onChange={(e) => setBkash(e.target.value)}
                          className="w-full bg-white border border-[#E2125D]/20 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#E2125D]"
                        />
                        <button
                          type="button"
                          onClick={() => handleLinkMFS('bkash', bkash)}
                          disabled={isPending || bkash.length < 11}
                          className="w-full bg-[#E2125D] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-30"
                        >
                          {t_prof("linkAccount") || "Link Account"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nagad Card */}
                  <div className={`p-6 rounded-[2.5rem] border transition-all ${user.nagadNumber ? 'bg-gradient-to-br from-white to-orange-50/10 border-orange-100 shadow-sm' : 'bg-[#F69320]/5 border-[#F69320]/10'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center p-2 border border-orange-100/50">
                        <Image 
                          src={NAGAD_LOGO_PRIMARY} 
                          alt="Nagad" 
                          width={48} 
                          height={48} 
                          className="object-contain" 
                        />
                      </div>
                      {user.nagadNumber ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-200 shadow-sm">
                          <BadgeCheck className="text-green-600 fill-green-600/10" size={14} />
                          ACTIVE LINK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-black rounded-full border border-gray-200">
                          UNLINKED
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nagad Account</p>
                    {user.nagadNumber ? (
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xl font-black text-gray-900 font-mono tracking-wider">{maskPhone(user.nagadNumber)}</p>
                        <span className="text-xs text-green-600 font-black flex items-center gap-1">
                          <ShieldCheck size={14} /> Linked
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label htmlFor="profile-nagad" className="sr-only">Nagad account number</label>
                        <input
                          id="profile-nagad"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={14}
                          autoComplete="off"
                          placeholder="01XXXXXXXXX"
                          value={nagad}
                          onChange={(e) => setNagad(e.target.value)}
                          className="w-full bg-white border border-[#F69320]/20 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#F69320]"
                        />
                        <button
                          type="button"
                          onClick={() => handleLinkMFS('nagad', nagad)}
                          disabled={isPending || nagad.length < 11}
                          className="w-full bg-[#F69320] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-30"
                        >
                          {t_prof("linkAccount") || "Link Account"}
                        </button>
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
                    className={`text-xs font-bold px-4 py-3 rounded-2xl ${msg.toLowerCase().includes("success") || msg.toLowerCase().includes("linked") ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}
                  >
                    {msg}
                  </motion.p>
                )}
               </AnimatePresence>
            </motion.div>

          </div>

          {/* Right Column: Reviews & Gamification */}
          <div className="space-y-8">
             {/* Dynamic Progress Card */}
             <motion.div variants={itemVariants} className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <Zap className="text-primary-400" size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Growth Path</p>
                      <h4 className="font-black text-xl leading-tight">Level {user.userLevel || 1}</h4>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                       <span>XP: {user.xp || 0}</span>
                       <span className="text-primary-400">{Math.round(calculateLevelProgress(user.xp || 0))}%</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${calculateLevelProgress(user.xp || 0)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary-500 to-blue-400 rounded-full" 
                       />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Badge</p>
                        <p className="text-xs font-bold truncate">Early Adopter</p>
                     </div>
                     <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                        <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Streak</p>
                        <p className="text-xs font-bold">{user.winningStreak || 0} Wins</p>
                     </div>
                  </div>
                </div>
             </motion.div>

             {/* Community Trust Section */}
             <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                  <MessageSquare size={22} className="text-primary-600" /> {t_prof("communityFeedback")}
                </h3>
                
                <div className="mb-8">
                  <TrustBadge 
                    rating={(user?.rating as number) || 3.5} 
                    ratingCount={(user?.ratingCount as number) || 0}
                    size="lg"
                  />
                </div>

                <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <ReviewList userId={session.user?.id || ""} />
                </div>
             </motion.div>

             {/* Help & Support Shortcut */}
             <motion.div variants={itemVariants} className="bg-primary-50 rounded-[2.5rem] p-8 border border-primary-100 group cursor-pointer hover:bg-primary-100 transition-all">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-primary-600">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 uppercase text-xs tracking-widest">{t_prof("needHelp") || "Need Help?"}</h4>
                        <p className="text-sm text-gray-600 font-medium">{t_prof("supportDesc") || "Contact our support team"}</p>
                      </div>
                   </div>
                   <ChevronRight className="text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" size={20} />
                </div>
             </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
