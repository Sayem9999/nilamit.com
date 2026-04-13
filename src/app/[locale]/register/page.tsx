"use client";

import { useState, useTransition, useEffect } from "react";
import { registerUser } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { Gavel, Loader2, ArrowRight, Smartphone, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function RegisterPage() {
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
  const router = useRouter();
  const t = useTranslations("Auth");

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
        setError(result.error || "Failed to send OTP.");
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
        setError(result.error || t("registrationFailed"));
      }
    });
  };

  // Timer logic
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-green-100 shadow-2xl text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">
            Welcome to Nilamit!
          </h2>
          <p className="text-gray-500 mb-8">
            Your account has been verified and created successfully. You can now start bidding.
          </p>
          <Link
            href="/login"
            className="block w-full bg-primary-600 text-white font-bold py-4 rounded-2xl hover:bg-primary-700 shadow-lg shadow-primary-100 transition-all"
          >
            Go to Login
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
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-gray-900">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>
          <h1 className="font-heading font-bold text-2xl text-gray-900">
            {t("createAccount")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Join Bangladesh's premium marketplace</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-gray-50 flex">
            <div className={`h-full bg-primary-600 transition-all duration-500 ${step === 'phone' ? 'w-1/3' : step === 'otp' ? 'w-2/3' : 'w-full'}`} />
          </div>

          <div className="p-8">
            {step === "phone" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Enter Phone Number</h3>
                  <p className="text-sm text-gray-500">We'll send you a 4-digit code to verify your phone.</p>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="+8801XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-lg font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleRequestOTP}
                    disabled={isPending || phone.length < 11}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-100 transition-all flex items-center justify-center gap-2"
                  >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send Verification Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <button onClick={() => setStep("phone")} className="text-xs font-bold text-primary-600 mb-4 hover:underline flex items-center gap-1">
                    ← Change Phone Number
                  </button>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Verify Code</h3>
                  <p className="text-sm text-gray-500">Sent to <span className="font-bold text-gray-900">{phone}</span></p>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="0000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-5 text-4xl font-bold tracking-[1em] text-center focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all"
                  />
                  <button
                    onClick={handleVerifyOTP}
                    disabled={otp.length !== 4}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-100 transition-all"
                  >
                    Verify & Continue
                  </button>
                  <div className="text-center">
                    {resendTimer > 0 ? (
                      <p className="text-xs text-gray-400">Resend code in {resendTimer}s</p>
                    ) : (
                      <button onClick={handleRequestOTP} className="text-xs font-bold text-primary-600 hover:underline">
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === "details" && (
              <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Complete Profile</h3>
                  <p className="text-sm text-gray-500">Just a few more details to get started.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Full Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Sayem Ahmed"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Password</label>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Confirm Password</label>
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs font-semibold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-100 transition-all flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Registration"}
                </button>
              </form>
            )}

            <div className="mt-8 text-center pt-6 border-t border-gray-50">
              <p className="text-sm text-gray-500">
                {t("alreadyHaveAccount")}{" "}
                <Link
                  href="/login"
                  className="text-primary-600 font-bold hover:underline decoration-2 underline-offset-4"
                >
                  {t("logInLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
