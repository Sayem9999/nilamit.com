"use client";

import { useState, useTransition, useEffect } from "react";
import { Gavel, Loader2, ArrowRight, Smartphone, CheckCircle, Mail, User } from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { signIn } from "next-auth/react";


export default function RegisterPage() {
  const t = useTranslations("Auth");
  const [step, setStep] = useState<"account-type" | "phone" | "otp" | "details">("account-type");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [signupMethod, setSignupMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Actions
  const handleRequestOTP = () => {
    if (!phone) return;
    setError("");
    startTransition(async () => {
      const { requestStandaloneOTP } = await import("@/actions/phone");
      const result = await requestStandaloneOTP(phone);
      if (result.success) {
        setStep("otp");
        setResendTimer(60);
      } else {
        setError(result.error?.message || t("errorGeneric"));
      }
    });
  };

  const handleVerifyOTP = () => {
    if (otp.length < 6) return;
    setError("");
    setStep("details");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    startTransition(async () => {
      if (signupMethod === "phone") {
        const { signupWithPhone } = await import("@/actions/auth");
        const result = await signupWithPhone({
          name: formData.name,
          phone,
          otp,
          password: formData.password,
          email: formData.email,
          isRetailer: accountType === "business"
        });

        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error?.message || t("errorGeneric"));
        }
      } else {
        const { registerUser } = await import("@/actions/auth");
        const result = await registerUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          isRetailer: accountType === "business"
        });

        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error?.message || t("errorGeneric"));
        }
      }
    });
  };

  // Timer logic
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] border border-green-100 shadow-2xl text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
            {t("welcomeTitle")}
          </h2>
          <p className="text-gray-500 mb-8 font-medium">
            {t("welcomeDesc")}
          </p>
          <Link
            href="/login"
            className="block w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-lg transition-all"
          >
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
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center shadow-sm">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>
          <h1 className="font-black text-3xl text-gray-900 tracking-tight">
            {t("signUpTitle")}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">{t("signUpDesc")}</p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-gray-50 flex">
            <div className={`h-full bg-primary-600 transition-all duration-500 ${
              step === 'account-type' ? 'w-1/4' : (signupMethod === 'email' ? 'w-full' : (step === 'phone' ? 'w-1/2' : step === 'otp' ? 'w-3/4' : 'w-full'))
            }`} />
          </div>

          <div className="p-8">
            {step === "account-type" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-gray-900 mb-1">Choose account type</h3>
                  <p className="text-sm text-gray-500 font-medium tracking-tight">Join Nilamit as a buyer or business retailer.</p>
                </div>
                
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setAccountType("personal");
                      setStep("phone");
                    }}
                    className="w-full p-6 bg-white border-2 border-gray-100 rounded-[2rem] text-left hover:border-primary-500 hover:bg-primary-50/30 transition-all group relative"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                        <Smartphone className="w-6 h-6 text-gray-400 group-hover:text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Personal Account</h4>
                        <p className="text-xs text-gray-500 font-medium">For casual bidding and selling.</p>
                      </div>
                    </div>
                    <ArrowRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                  </button>

                  <button
                    onClick={() => {
                      setAccountType("business");
                      setStep("phone");
                    }}
                    className="w-full p-6 bg-white border-2 border-gray-100 rounded-[2rem] text-left hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group relative"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                        <Gavel className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Business Account</h4>
                        <p className="text-xs text-gray-500 font-medium">For retailers and high-volume sales.</p>
                      </div>
                    </div>
                    <ArrowRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                        OR
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      signIn("google", { callbackUrl: "/dashboard" });
                    }}

                    className="w-full h-14 bg-white border-2 border-gray-100 hover:border-primary-500 hover:bg-primary-50/30 text-gray-700 rounded-2xl transition-all font-bold text-lg flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t("googleBtn")}
                  </button>
                </div>
              </div>
            )}

            {/* Signup Method Tabs */}
            {step === "phone" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                  onClick={() => setStep("account-type")} 
                  className="mb-4 text-[10px] font-black text-gray-400 hover:text-primary-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                >
                  <ArrowRight className="w-3 h-3 rotate-180" /> Back to Account Selection
                </button>
                <div className="flex bg-gray-50/50 p-1 mb-8 rounded-2xl border border-gray-100">
                  <button
                    onClick={() => setSignupMethod("phone")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                      signupMethod === "phone"
                        ? "bg-white text-primary-600 shadow-sm border border-gray-100"
                        : "text-gray-400 hover:text-gray-900 uppercase tracking-widest text-[10px]"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    {t("phoneBtn")}
                  </button>
                  <button
                    onClick={() => setSignupMethod("email")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                      signupMethod === "email"
                        ? "bg-white text-primary-600 shadow-sm border border-gray-100"
                        : "text-gray-400 hover:text-gray-900 uppercase tracking-widest text-[10px]"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    {t("emailBtn")}
                  </button>
                </div>
              </div>
            )}

            {signupMethod === "email" && step === "phone" ? (
               <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {accountType === "business" ? "Business Email Signup" : t("emailSignupTitle")}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">{t("emailSignupDesc")}</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email-signup-name" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
                      {accountType === "business" ? "Shop Name / Rep Name" : t("nameLabel")}
                    </label>
                    <input
                      id="email-signup-name"
                      required
                      type="text"
                      autoComplete={accountType === "business" ? "organization" : "name"}
                      placeholder={accountType === "business" ? "e.g. Dhaka Electronics" : "e.g. Sayem Ahmed"}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="email-signup-email" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("emailLabel")}</label>
                    <input
                      id="email-signup-email"
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="email-signup-password" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("passwordLabel")}</label>
                    <input
                      id="email-signup-password"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="email-signup-confirm" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("confirmPasswordLabel")}</label>
                    <input
                      id="email-signup-confirm"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                  className={`w-full ${accountType === "business" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-900 hover:bg-black"} disabled:bg-gray-200 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2`}
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t("signUpBtn")}
                </button>
              </form>
            ) : (
              <>
                {step === "phone" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {accountType === "business" ? "Business Phone Signup" : t("enterPhoneTitle")}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">{t("enterPhoneDesc")}</p>
                </div>
                <div className="space-y-4">
                  <div className="relative group">
                    <label htmlFor="phone-signup-name" className="sr-only">{accountType === "business" ? "Shop name" : t("nameLabel")}</label>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center" aria-hidden="true">
                      <User className="w-5 h-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                    </div>
                    <input
                      id="phone-signup-name"
                      type="text"
                      autoComplete={accountType === "business" ? "organization" : "name"}
                      placeholder={accountType === "business" ? "Shop Name" : t("nameLabel")}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-5 text-xl font-bold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div className="relative group">
                    <label htmlFor="phone-signup-phone" className="sr-only">{t("phoneLabel")}</label>
                    <Smartphone aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                    <input
                      id="phone-signup-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+8801XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-5 text-xl font-bold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleRequestOTP}
                    disabled={isPending || phone.length < 11 || formData.name.length < 2}
                    className={`w-full h-14 ${accountType === "business" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-900 hover:bg-black"} disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2`}
                  >
                    {isPending ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        {t("sendCodeBtn")}
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <button onClick={() => setStep("phone")} className="text-[10px] font-bold text-primary-600 mb-4 hover:underline flex items-center gap-1 uppercase tracking-widest">
                    {"← " + t("changePhone")}
                  </button>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("verifyCodeTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">
                    {t("sentTo")} <span className="font-bold text-gray-900">{phone}</span>
                  </p>
                </div>
                <div className="space-y-6">
                  <label htmlFor="phone-otp-input" className="sr-only">6-digit verification code</label>
                  <input
                    id="phone-otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    aria-label="6-digit verification code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-3xl px-4 py-6 text-5xl font-black tracking-[0.5em] text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                  />
                  <button
                    onClick={handleVerifyOTP}
                    disabled={otp.length !== 6}
                    className={`w-full h-14 ${accountType === "business" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-900 hover:bg-black"} disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all`}
                  >
                    {t("verifyContinue")}
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
            </>
            )}

            {step === "details" && (
              <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("completeProfileTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">{t("completeProfileDesc")}</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="details-email" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("emailLabel")} ({t("maybeLater")})</label>
                    <input
                      id="details-email"
                      type="email"
                      autoComplete="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="details-password" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("passwordLabel")}</label>
                    <input
                      id="details-password"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="details-confirm" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("confirmPasswordLabel")}</label>
                    <input
                      id="details-confirm"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                  className={`w-full h-14 ${accountType === "business" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-900 hover:bg-black"} disabled:bg-gray-200 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest`}
                >
                  {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : t("signUpBtn")}
                </button>
              </form>
            )}

            <div className="mt-8 text-center pt-8 border-t border-gray-100">
              <p className="text-gray-500 font-medium tracking-tight">
                {t("alreadyHaveAccount")}{" "}
                <Link
                  href="/login"
                  className="text-primary-600 font-black hover:text-primary-700 transition-colors underline decoration-2 underline-offset-4"
                >
                  {t("signInBtn")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
