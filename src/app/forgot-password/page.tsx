"use client";

import { useState, useTransition } from "react";
import { Gavel, Loader2, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Step = "identifier" | "otp" | "reset";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const [step, setStep] = useState<Step>("identifier");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handleRequestOTP = () => {
    if (!email) return;
    setError("");
    startTransition(async () => {
      try {
        const { sendEmailOTP } = await import("@/actions/otp");
        const result = await sendEmailOTP(email);
        if (result.success) {
          setStep("otp");
          setResendTimer(60);
        } else {
          setError(result.error?.message || t("errorGeneric"));
        }
      } catch (err) {
        setError(t("errorGeneric"));
      }
    });
  };

  const handleVerifyOTP = () => {
    if (otp.length < 6) return;
    setError("");
    startTransition(async () => {
      // For email, we just move to the reset step and verify the OTP during the final submission
      setStep("reset");
    });
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
        email: email,
        otp: otp,
        password,
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error?.message || t("errorGeneric"));
      }
    });
  };

  if (success) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] border border-blue-100 shadow-2xl text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
            <ShieldCheck className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
            {t("resetPasswordTitle")}
          </h1>
          <p className="text-gray-500 mb-8 font-medium">
            {t("verificationSuccess")}
          </p>
          <Link
            href="/login"
            className="block w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {t("goToLogin")}
          </Link>
        </div>
      </main>
    );
  }

  const errorBlock = error ? (
    <p
      role="alert"
      aria-live="polite"
      className="text-xs font-bold text-red-500 bg-red-50 p-4 rounded-xl border border-red-100 text-center"
    >
      {error}
    </p>
  ) : null;

  const stepIdx = step === "identifier" ? 1 : step === "otp" ? 2 : 3;

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center shadow-sm" aria-hidden="true">
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
          <div
            role="progressbar"
            aria-label="Password reset progress"
            aria-valuenow={stepIdx}
            aria-valuemin={1}
            aria-valuemax={3}
            className="h-1.5 w-full bg-gray-50 flex"
          >
            <div
              className={`h-full bg-primary-600 transition-all duration-500 motion-reduce:transition-none ${
                step === "identifier" ? "w-1/3" : step === "otp" ? "w-2/3" : "w-full"
              }`}
              aria-hidden="true"
            />
          </div>

          <div className="p-8">
            {step === "identifier" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {t("enterEmailTitle")}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">
                    {t("enterEmailDesc")}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <label htmlFor="forgot-email" className="sr-only">
                      {t("emailLabel")}
                    </label>
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" aria-hidden="true" />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-5 font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                    />
                  </div>

                  {errorBlock}

                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    disabled={isPending || !email}
                    aria-label={isPending ? "Sending reset code" : t("sendResetBtn")}
                    className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    {isPending ? (
                      <Loader2 className="w-6 h-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <>
                        {t("sendResetBtn")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none">
                <div className="mb-6 text-center">
                  <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                    <ShieldCheck className="w-8 h-8 text-primary-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t("verifyCodeTitle")}</h2>
                  <p className="text-sm text-gray-500 font-medium">
                    {t("sentTo")} <span className="font-bold text-gray-900">{email}</span>
                  </p>
                </div>
                <div className="space-y-6">
                  <label htmlFor="forgot-otp" className="sr-only">6-digit verification code</label>
                  <input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    aria-label="6-digit verification code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] px-4 py-6 text-5xl font-black tracking-[0.5em] text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white outline-none transition-all"
                  />

                  {errorBlock}

                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={otp.length !== 6}
                    className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    {t("verifyBtn")}
                  </button>
                </div>
              </div>
            )}

            {step === "reset" && (
              <form
                onSubmit={handleResetPassword}
                aria-label="Set new password"
                className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none"
              >
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{t("resetPasswordTitle")}</h2>
                  <p className="text-sm text-gray-500 font-medium">{t("resetPasswordDesc")}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="forgot-password-new" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
                      {t("passwordLabel")}
                    </label>
                    <input
                      id="forgot-password-new"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="forgot-password-confirm" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
                      {t("confirmPasswordLabel")}
                    </label>
                    <input
                      id="forgot-password-confirm"
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {errorBlock}

                <button
                  type="submit"
                  disabled={isPending}
                  aria-label={isPending ? "Updating password" : t("resetPasswordTitle")}
                  className="w-full h-14 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  {isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    t("resetPasswordTitle")
                  )}
                </button>
              </form>
            )}

            <div className="mt-8 text-center pt-8 border-t border-gray-100">
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-gray-900 font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                {t("signInBtn")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
