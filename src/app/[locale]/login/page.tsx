"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  // Ensure redirect respects the [locale] segment — raw "/dashboard" 404s.
  const callbackUrl = rawCallback
    ? (rawCallback.startsWith(`/${locale}/`) || rawCallback === `/${locale}`
        ? rawCallback
        : `/${locale}${rawCallback.startsWith('/') ? rawCallback : `/${rawCallback}`}`)
    : `/${locale}/dashboard`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(t("errorGeneric"));
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error) {
       toast.error(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-[2rem] shadow-xl shadow-primary-500/20 mb-6">
             <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
            nilam<span className="text-primary-600 font-bold">it</span>
          </h1>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("signInTitle")}
          </h2>
          <p className="text-gray-500 mt-2 font-medium">
            {t("signInDesc")}
          </p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit} aria-label={t("signInTitle")}>
            <div className="space-y-1">
              <label htmlFor="login-email" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
                {t("emailLabel")}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-600 transition-colors" aria-hidden="true">
                  <Mail size={18} />
                </div>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-14 bg-gray-50 border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-lg font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center pl-1 mb-1">
                <label htmlFor="login-password" className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-bold">
                  {t("passwordLabel")}
                </label>
                <Link
                  href={`/${locale}/forgot-password`}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-600 transition-colors" aria-hidden="true">
                  <Lock size={18} />
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-14 bg-gray-50 border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-lg font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl transition-all shadow-lg hover:shadow-xl font-bold text-lg group focus-visible:ring-4 focus-visible:ring-primary-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                  <span className="sr-only">{t("signInBtn")}</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {t("signInBtn")}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center pt-8 border-t border-gray-100">
            <p className="text-gray-500 font-medium tracking-tight">
              {t("noAccount")}{" "}
              <Link
                href={`/${locale}/register`}
                className="text-primary-600 font-black hover:text-primary-700 transition-colors underline decoration-2 underline-offset-4"
              >
                {t("signUpBtn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
