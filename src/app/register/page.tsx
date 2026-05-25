"use client";

import { useState, useTransition } from "react";
import { Gavel, Loader2, ArrowRight, CheckCircle, User } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const t = useTranslations("Auth");
  const [step, setStep] = useState<"account-type" | "email-form">("account-type");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }

    startTransition(async () => {
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
    });
  };

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
              step === 'account-type' ? 'w-1/2' : 'w-full'
            }`} />
          </div>

          <div className="p-8">
            {step === "account-type" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-gray-900 mb-1">Choose Account Category</h3>
                  <p className="text-sm text-gray-500 font-medium tracking-tight">Select whether you are a casual standard user or a professional retailer.</p>
                </div>
                
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setAccountType("personal");
                      setStep("email-form");
                    }}
                    className="w-full p-6 bg-white border-2 border-gray-100 rounded-[2rem] text-left hover:border-primary-500 hover:bg-primary-50/30 transition-all group relative"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                        <User className="w-6 h-6 text-gray-400 group-hover:text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Seller / Bidder (Standard)</h4>
                        <p className="text-xs text-gray-500 font-medium">For standard bidding, buying, and casual selling.</p>
                      </div>
                    </div>
                    <ArrowRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                  </button>

                  <button
                    onClick={() => {
                      setAccountType("business");
                      setStep("email-form");
                    }}
                    className="w-full p-6 bg-white border-2 border-gray-100 rounded-[2rem] text-left hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group relative"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                        <Gavel className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Professional Retailer</h4>
                        <p className="text-xs text-gray-500 font-medium">For verified businesses, shops, and bulk inventory tools.</p>
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

                  <button
                    onClick={() => {
                      signIn("facebook", { callbackUrl: "/dashboard" });
                    }}
                    className="w-full h-14 bg-white border-2 border-gray-100 hover:border-[#1877F2] hover:bg-[#1877F2]/5 text-gray-700 rounded-2xl transition-all font-bold text-lg flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6 fill-[#1877F2]" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    {t("facebookBtn")}
                  </button>
                </div>
              </div>
            )}

            {step === "email-form" && (
              <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                  type="button"
                  onClick={() => setStep("account-type")} 
                  className="mb-4 text-[10px] font-black text-gray-400 hover:text-primary-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                >
                  <ArrowRight className="w-3 h-3 rotate-180" /> Back to Account Selection
                </button>

                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {accountType === "business" ? "Professional Retailer Signup" : t("emailSignupTitle")}
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
