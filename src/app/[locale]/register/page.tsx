"use client";

import { useState, useTransition, useEffect } from "react";
import { Gavel, Loader2, ArrowRight, Smartphone, CheckCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

export default function RegisterPage() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [signupMethod, setSignupMethod] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"phone" | "otp" | "details">("phone");
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
        setError(result.error || t("errorGeneric"));
      }
    });
  };

  const handleVerifyOTP = () => {
    if (otp.length < 4) return;
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
        });

        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error || t("errorGeneric"));
        }
      } else {
        // Email Signup Path
        const { registerUser } = await import("@/actions/auth");
        const result = await registerUser({
          firstName: formData.name.split(' ')[0],
          lastName: formData.name.split(' ').slice(1).join(' ') || '.',
          email: formData.email,
          password: formData.password
        });

        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error || t("errorGeneric"));
        }
      }
    });
  };

  // Timer logic
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendTimer]);

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] border border-green-100 shadow-2xl text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
            {t("welcomeTitle")}
          </h2>
          <p className="text-gray-500 mb-8 font-medium">
            {t("welcomeDesc")}
          </p>
          <Link
            href={`/${locale}/login`}
            className="block w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-lg transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
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
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xl"
            aria-label="nilamit home"
          >
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
              <Gavel className="w-5 h-5 text-white" aria-hidden="true" />
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
          <div
            className="h-1.5 w-full bg-gray-50 flex"
            role="progressbar"
            aria-label={t("signUpTitle")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              signupMethod === 'email' ? 100 : step === 'phone' ? 33 : step === 'otp' ? 66 : 100
            }
          >
            <div className={`h-full bg-primary-600 transition-all duration-500 ${
              signupMethod === 'email' ? 'w-full' : (step === 'phone' ? 'w-1/3' : step === 'otp' ? 'w-2/3' : 'w-full')
            }`} />
          </div>

          <div className="p-8">
            {/* Signup Method Tabs */}
            {step === "phone" && (
              <div
                className="flex bg-gray-50/50 p-1 mb-8 rounded-2xl border border-gray-100"
                role="tablist"
                aria-label={t("signUpTitle")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={signupMethod === "phone"}
                  aria-controls="signup-panel"
                  onClick={() => setSignupMethod("phone")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    signupMethod === "phone"
                      ? "bg-white text-primary-600 shadow-sm border border-gray-100"
                      : "text-gray-400 hover:text-gray-900 uppercase tracking-widest text-[10px]"
                  }`}
                >
                  <Smartphone className="w-4 h-4" aria-hidden="true" />
                  {t("phoneBtn")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={signupMethod === "email"}
                  aria-controls="signup-panel"
                  onClick={() => setSignupMethod("email")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    signupMethod === "email"
                      ? "bg-white text-primary-600 shadow-sm border border-gray-100"
                      : "text-gray-400 hover:text-gray-900 uppercase tracking-widest text-[10px]"
                  }`}
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  {t("emailBtn")}
                </button>
              </div>
            )}

            <div id="signup-panel" role="tabpanel">
            {signupMethod === "email" && step === "phone" ? (
               <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300" aria-label={t("emailSignupTitle")}>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("emailSignupTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">{t("emailSignupDesc")}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="register-email-name" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("nameLabel")}</label>
                    <input
                      id="register-email-name"
                      required
                      aria-required="true"
                      autoComplete="name"
                      type="text"
                      placeholder="e.g. Sayem Ahmed"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email-address" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("emailLabel")}</label>
                    <input
                      id="register-email-address"
                      required
                      aria-required="true"
                      autoComplete="email"
                      type="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email-password" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("passwordLabel")}</label>
                    <input
                      id="register-email-password"
                      required
                      aria-required="true"
                      autoComplete="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email-confirm" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("confirmPasswordLabel")}</label>
                    <input
                      id="register-email-confirm"
                      required
                      aria-required="true"
                      autoComplete="new-password"
                      aria-describedby={error ? "register-email-error" : undefined}
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <p id="register-email-error" role="alert" className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      <span className="sr-only">{t("signUpBtn")}</span>
                    </>
                  ) : (
                    t("signUpBtn")
                  )}
                </button>
              </form>
            ) : (
              <>
                {step === "phone" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("enterPhoneTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">{t("enterPhoneDesc")}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="register-phone" className="sr-only">{t("enterPhoneTitle")}</label>
                    <div className="relative group">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" aria-hidden="true" />
                      <input
                        id="register-phone"
                        type="tel"
                        autoComplete="tel"
                        aria-describedby={error ? "register-phone-error" : undefined}
                        placeholder="+8801XXXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-5 text-xl font-bold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>
                  {error && (
                    <p id="register-phone-error" role="alert" className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    disabled={isPending || phone.length < 11}
                    aria-busy={isPending}
                    className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                        <span className="sr-only">{t("sendCodeBtn")}</span>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {t("sendCodeBtn")}
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    className="text-[10px] font-bold text-primary-600 mb-4 hover:underline flex items-center gap-1 uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                  >
                    {"← " + t("changePhone")}
                  </button>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("verifyCodeTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">
                    {t("sentTo")} <span className="font-bold text-gray-900">{phone}</span>
                  </p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="register-otp" className="sr-only">{t("verifyCodeTitle")}</label>
                    <input
                      id="register-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      aria-label={t("verifyCodeTitle")}
                      placeholder="0000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-gray-50 border border-gray-100 rounded-3xl px-4 py-6 text-5xl font-black tracking-[0.5em] text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={otp.length !== 4}
                    className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
                  >
                    {t("verifyContinue")}
                  </button>
                  <div className="text-center pt-2">
                    {resendTimer > 0 ? (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest" aria-live="polite">
                        {t("resendIn")} {resendTimer}s
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOTP}
                        className="text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                      >
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
              <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300" aria-label={t("completeProfileTitle")}>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t("completeProfileTitle")}</h3>
                  <p className="text-sm text-gray-500 font-medium">{t("completeProfileDesc")}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="register-details-name" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("nameLabel")}</label>
                    <input
                      id="register-details-name"
                      required
                      aria-required="true"
                      autoComplete="name"
                      type="text"
                      placeholder="e.g. Sayem Ahmed"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-details-email" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("emailLabel")} ({t("maybeLater")})</label>
                    <input
                      id="register-details-email"
                      type="email"
                      autoComplete="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-details-password" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("passwordLabel")}</label>
                    <input
                      id="register-details-password"
                      required
                      aria-required="true"
                      autoComplete="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-details-confirm" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">{t("confirmPasswordLabel")}</label>
                    <input
                      id="register-details-confirm"
                      required
                      aria-required="true"
                      autoComplete="new-password"
                      aria-describedby={error ? "register-details-error" : undefined}
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <p id="register-details-error" role="alert" className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                      <span className="sr-only">{t("signUpBtn")}</span>
                    </>
                  ) : (
                    t("signUpBtn")
                  )}
                </button>
              </form>
            )}
            </div>

            <div className="mt-8 text-center pt-8 border-t border-gray-100">
              <p className="text-gray-500 font-medium tracking-tight">
                {t("alreadyHaveAccount")}{" "}
                <Link
                  href={`/${locale}/login`}
                  className="text-primary-600 font-black hover:text-primary-700 transition-colors underline decoration-2 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
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
