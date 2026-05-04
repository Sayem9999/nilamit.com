"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { sanitizeRedirect } from "@/lib/url-safety";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  // sanitizeRedirect blocks open-redirect attacks via ?callbackUrl=https://evil.com
  const callbackUrl = sanitizeRedirect(searchParams.get("callbackUrl"), "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      toast.error(t("errorGeneric"));
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          toast.error("Invalid email or password");
        } else {
          toast.error(t("errorGeneric"));
        }
      } else if (result?.url) {
        router.push(result.url);
        router.refresh();
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
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
                {t("emailLabel")}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-600 transition-colors">
                  <Mail size={18} />
                </div>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-14 bg-gray-50 border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-lg font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center pl-1 mb-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-bold">
                  {t("passwordLabel")}
                </label>
                <Link 
                  href="/forgot-password"
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors uppercase tracking-widest"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-600 transition-colors">
                  <Lock size={18} />
                </div>
                <Input
                  type="password"
                  required
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
              className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl transition-all shadow-lg hover:shadow-xl font-bold text-lg group"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  {t("signInBtn")}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                  OR
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
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
            </Button>
          </form>

          <div className="mt-8 text-center pt-8 border-t border-gray-100">
            <p className="text-gray-500 font-medium tracking-tight">
              {t("noAccount")}{" "}
              <Link
                href="/register"
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
