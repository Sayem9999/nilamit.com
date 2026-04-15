"use client";

import { useState, useTransition, useEffect } from "react";
import { Gavel, Loader2, ArrowRight, Smartphone, Mail, CheckCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const [step, setStep] = useState<"identifier" | "otp" | "reset">("identifier");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handleRequestOTP = () => {
    if (!identifier) return;
    setError("");
    startTransition(async () => {
      let result;
      if (method === "phone") {
        const { requestStandaloneOTP } = await import("@/actions/phone");
        result = await requestStandaloneOTP(identifier);
      } else {
        // Mock email OTP for now
        result = { success: true }; 
      }

      if (result.success) {
        setStep("otp");
        setResendTimer(60);
      } else {
        setError(result.error || t("errorGeneric"));
      }
    });
  };

  const handleVerifyOTP = () => {
    if (otp.length < 4) return;
    setStep("reset");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    startTransition(async () => {
      const { resetPasswordWithOTP } = await import("@/actions/auth");
      const result = await resetPasswordWithOTP({
        phone: method === "phone" ? identifier : undefined,
        email: method === "email" ? identifier : undefined,
        otp,
        password,
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || t("errorGeneric"));
      }
    });
  };

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] border border-blue-100 shadow-2xl text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
             {t("resetPasswordTitle")}
          </h2>
          <p className="text-gray-500 mb-8 font-medium">
            {t("verificationSuccess")}
          </p>
          <Link href="/login" className="block w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-lg transition-all">
            {t("goToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>
          <h1 className="font-black text-3xl text-gray-900 tracking-tight">
            {t("forgotPasswordTitle")}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">{t("forgotPasswordDesc")}</p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gray-50 flex">
            <div className={`h-full bg-primary-600 transition-all duration-500 ${step === 'identifier' ? 'w-1/3' : step === 'otp' ? 'w-2/3' : 'w-full'}`} />
          </div>

          <div className="p-8">
            {step === "identifier" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex bg-gray-50/50 p-1 mb-6 rounded-2xl border border-gray-100">
                  <button onClick={() => setMethod("phone")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${method === "phone" ? "bg-white text-primary-600 shadow-sm border border-gray-100" : "text-gray-400 uppercase tracking-widest text-[10px]"}`}>
                    <Smartphone className="w-3.5 h-3.5" /> {t("phoneBtn")}
                  </button>
                  <button onClick={() => setMethod("email")} className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${method === "email" ? "bg-white text-primary-600 shadow-sm border border-gray-100" : "text-gray-400 uppercase tracking-widest text-[10px]"}`}>
                    <Mail className="w-3.5 h-3.5" /> {t("emailBtn")}
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("enterPhoneTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">{t("enterPhoneDesc")}</p>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    {method === "phone" ? <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" /> : <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />}
                    <input
                      type={method === "phone" ? "tel" : "email"}
                      placeholder={method === "phone" ? "+8801XXXXXXXXX" : "email@example.com"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-5 font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleRequestOTP}
                    disabled={isPending || !identifier}
                    className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{t("sendResetBtn")} <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6 text-center">
                  <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("verifyCodeTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">
                    {t("sentTo")} <span className="font-bold text-gray-900">{identifier}</span>
                  </p>
                </div>
                <div className="space-y-6">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="0000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] px-4 py-6 text-5xl font-black tracking-[0.5em] text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                  />
                  <button
                    onClick={handleVerifyOTP}
                    disabled={otp.length !== 4}
                    className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all uppercase tracking-widest"
                  >
                    {t("verifyBtn")}
                  </button>
                  <div className="text-center pt-2">
                    {resendTimer > 0 ? (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                         {t("resendIn")} {resendTimer}s
                      </p>
                    ) : (
                      <button onClick={handleRequestOTP} className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest">
                        {t("resendBtn")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("resetPasswordTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">{t("resetPasswordDesc")}</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("passwordLabel")}</label>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("confirmPasswordLabel")}</label>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : t("resetPasswordTitle")}
                </button>
              </form>
            )}

            <div className="mt-8 text-center pt-8 border-t border-gray-100">
              <Link href="/login" className="text-sm text-gray-400 hover:text-gray-900 font-bold uppercase tracking-widest transition-colors">
                {t("signInBtn")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
