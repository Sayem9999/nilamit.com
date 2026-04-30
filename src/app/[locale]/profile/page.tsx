"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateProfile, linkMFSAccount } from "@/actions/user";
import { sendPhoneOTP, verifyPhoneOTP } from "@/actions/phone";
import {
  User,
  Phone,
  Shield,
  CheckCircle,
  Edit3,
  Save,
  Star,
  MessageSquare,
  Wallet,
  Mail,
  Smartphone,
  AlertTriangle,
  BadgeCheck,
} from "lucide-react";
import { ReviewList } from "@/components/review/ReviewList";
import TrustBadge from "@/components/social/TrustBadge";
import VerificationBadge from "@/components/social/VerificationBadge";
import Image from "next/image";

export default function ProfilePage() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const t_prof = useTranslations("Profile");
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

  const maskPhone = (num: string) => {
    if (!num) return "";
    return num.slice(0, 3) + "****" + num.slice(-4);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user as { 
    id: string; 
    isPhoneVerified: boolean; 
    reputationScore: number; 
    phone?: string; 
    email?: string;
    bkashNumber?: string;
    nagadNumber?: string;
  };
  const isPhoneVerified = user?.isPhoneVerified as boolean;

  const handleSaveName = () => {
    startTransition(async () => {
      await updateProfile({ name });
      await update();
      setEditing(false);
      setName(""); // Reset local state
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
        setMsg(t_prof("verificationSuccess"));
        await update();
      } else setMsg(res.error?.message || t_prof("errorGeneric"));
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading font-bold text-2xl text-gray-900 mb-6">
        {t_prof("title")}
      </h1>

      {/* Verification Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-3xl border transition-all ${user?.isPhoneVerified ? 'bg-blue-50/50 border-blue-100' : 'bg-amber-50/50 border-amber-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Smartphone className={`w-5 h-5 ${user?.isPhoneVerified ? 'text-blue-600' : 'text-amber-600'}`} />
            </div>
            {user?.isPhoneVerified ? (
              <BadgeCheck className="w-5 h-5 text-blue-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t_prof("phoneStatus")}</p>
          <p className={`text-sm font-bold ${user?.isPhoneVerified ? 'text-blue-900' : 'text-amber-900'}`}>
            {user?.isPhoneVerified ? t_prof("verified") : t_prof("actionRequired")}
          </p>
          {user?.phone && <p className="text-xs text-gray-500 font-mono mt-1">{user.phone}</p>}
        </div>

        <div className={`p-4 rounded-3xl border transition-all ${(session.user as { emailVerified?: Date | null }).emailVerified ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50/50 border-gray-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Mail className={`w-5 h-5 ${(session.user as { emailVerified?: Date | null }).emailVerified ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            {(session.user as { emailVerified?: Date | null }).emailVerified ? (
              <BadgeCheck className="w-5 h-5 text-blue-600" />
            ) : (
              <div className="w-5 h-5 bg-gray-200 rounded-full" />
            )}
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t_prof("emailStatus")}</p>
          <p className={`text-sm font-bold ${(session.user as { emailVerified?: Date | null }).emailVerified ? 'text-blue-900' : 'text-gray-900'}`}>
            {(session.user as { emailVerified?: Date | null }).emailVerified ? t_prof("verified") : t_prof("linkedStatus")}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-1">{session.user?.email}</p>
        </div>
      </div>

      {!user?.isPhoneVerified && (
        <div className="bg-amber-600 text-white p-4 rounded-3xl mb-8 flex items-start gap-3 shadow-lg shadow-amber-100 animate-in fade-in slide-in-from-top-4 duration-500">
           <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
           <div>
             <p className="text-sm font-black uppercase tracking-wider mb-1">{t_prof("actionRequired")}</p>
             <p className="text-xs text-amber-50 font-medium">{t_prof("identityDesc")}</p>
           </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-primary-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <p className="font-heading font-semibold text-lg text-gray-900">
                {session.user?.name}
              </p>
              <VerificationBadge
                isPhoneVerified={user.isPhoneVerified}
                emailVerified={(session.user as { emailVerified?: Date | string | null }).emailVerified || null}
                isVerifiedSeller={!!(user as { isVerifiedSeller?: boolean }).isVerifiedSeller}
                size="md"
              />
            </div>
            <p className="text-sm text-gray-500">{session.user?.email}</p>
          </div>
        </div>

        {/* Name Edit */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            {t_prof("displayName")}
          </label>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <button
                onClick={handleSaveName}
                disabled={isPending}
                className="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 flex items-center gap-1"
              >
                <Save className="w-4 h-4" /> {t_prof("save")}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">
                {session.user?.name || t_prof("notSet")}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> {t_prof("edit")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reputation Card */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 mb-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4">
           <Star className="w-8 h-8 text-primary-500/10 fill-primary-500/5 rotate-12" />
        </div>
        <div className="flex flex-col gap-4 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                {t_prof("reputationRank")}
              </p>
              <TrustBadge 
                score={(user?.reputationScore as number) || 0} 
                size="lg"
              />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                {t_prof("trustPoints")}
              </p>
              <p className="text-2xl font-black text-gray-900 leading-none">
                {(user?.reputationScore as number) || 0}
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-50 flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider bn">
             <span className="flex items-center gap-1">
               <Shield className="w-3 h-3 text-blue-500" /> {t_prof("bayesianCertified")}
             </span>
             <span className="flex items-center gap-1">
               <CheckCircle className="w-3 h-3 text-emerald-500" /> {t_prof("activeTrader")}
             </span>
          </div>
        </div>
      </div>

      {/* MFS Linkage Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="font-heading font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary-600" /> {t_prof("mfsTitle")}
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          {t_prof("mfsSubtitle")}
        </p>

        <div className="space-y-6">
          {/* bKash */}
          <div>
             <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t_prof("bkashAccount")}</span>
                {user?.bkashNumber ? (
                  <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">{t_prof("linked")}</span>
                ) : (
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">{t_prof("notLinked")}</span>
                )}
             </div>
             {user?.bkashNumber ? (
                <div className="p-3 bg-gray-50 rounded-xl text-sm font-mono border border-gray-100 flex items-center justify-between">
                  <span>{maskPhone(user.bkashNumber)}</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
             ) : (
               <div className="flex gap-2">
                 <input
                   placeholder="01XXXXXXXXX"
                   value={bkash}
                   onChange={(e) => setBkash(e.target.value)}
                   className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                 />
                  <button
                    onClick={() => handleLinkMFS('bkash', bkash)}
                    disabled={isPending || bkash.length < 11}
                    className="bg-[#E2125D] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:bg-gray-200 transition"
                  >
                    {t_prof("linkBtn")}
                  </button>
               </div>
             )}
          </div>

          {/* Nagad */}
          <div>
             <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t_prof("nagadAccount")}</span>
                {user?.nagadNumber ? (
                  <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">{t_prof("linked")}</span>
                ) : (
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">{t_prof("notLinked")}</span>
                )}
             </div>
             {user?.nagadNumber ? (
                <div className="p-3 bg-gray-50 rounded-xl text-sm font-mono border border-gray-100 flex items-center justify-between">
                  <span>{maskPhone(user.nagadNumber)}</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
             ) : (
               <div className="flex gap-2">
                 <input
                   placeholder="01XXXXXXXXX"
                   value={nagad}
                   onChange={(e) => setNagad(e.target.value)}
                   className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                 />
                  <button
                    onClick={() => handleLinkMFS('nagad', nagad)}
                    disabled={isPending || nagad.length < 11}
                    className="bg-[#F69320] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:bg-gray-200 transition"
                  >
                    {t_prof("linkBtn")}
                  </button>
               </div>
             )}
          </div>
        </div>

        <p
          className={`mt-4 text-sm px-3 py-2 rounded-lg ${msg.includes("linked") || msg.includes("সফলভাবে") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
        >
          {msg}
        </p>
      </div>

      {/* Reviews Section */}
      <div className="mb-8 border-t border-gray-100 pt-8">
        <h2 className="font-heading font-bold text-xl text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-600" /> {t_prof("communityFeedback")}
        </h2>
        <ReviewList userId={session.user?.id || ""} />
      </div>

      {/* Phone Verification (Mandatory for Members) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="font-heading font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary-600" /> {t_prof("memberVerification")}
        </h2>
        <p className="text-xs text-gray-500 mb-6">{t_prof("identityDesc")}</p>

        {isPhoneVerified ? (
          <div className="flex items-center gap-2 text-green-700 text-xs">
            <CheckCircle className="w-4 h-4" />
            <span>
              {t_prof("verified")}: <strong>{maskPhone(user?.phone as string)}</strong>
            </span>
          </div>
        ) : phoneStep === "idle" ? (
          <button
            onClick={() => setPhoneStep("input")}
            className="w-full bg-primary-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary-700 transition"
          >
            {t_prof("startVerification")}
          </button>
        ) : phoneStep === "input" ? (
          <div className="flex flex-col gap-3">
             <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801XXXXXXXXX"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
               onClick={handleSendOTP}
               disabled={isPending || phone.length < 11}
               className="bg-primary-600 text-white px-4 py-3 rounded-xl text-sm font-bold disabled:bg-gray-200 transition"
            >
              {t_prof("sendOTP")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
             <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder={t_prof("enterOTP")}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
               onClick={handleVerifyOTP}
               disabled={isPending || otp.length < 6}
               className="bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-bold disabled:bg-gray-200 transition"
            >
              {t_prof("verifyUnlock")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
