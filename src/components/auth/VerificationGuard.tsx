"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { ShieldAlert, X, CheckCircle, Smartphone, Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface VerificationGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onVerifyClick?: () => void;
  requiredLevel?: "phone" | "email";
}

/**
 * VerificationGuard wraps actions that require a verified account.
 * It checks if EITHER phone OR email is verified.
 */
export function VerificationGuard({ children }: VerificationGuardProps) {
  const { data: session } = useSession();
  const [showModal, setShowModal] = useState(false);
  const t = useTranslations("Auth");

  // Check verification and restriction status
  const isBanned = session?.user?.isBanned;
  const isVerified = (session?.user?.isPhoneVerified || !!session?.user?.emailVerified) && !isBanned;

  const handleClick = (e: React.MouseEvent) => {
    if (!session) {
      window.location.href = "/login";
      return;
    }

    if (!isVerified) {
      e.preventDefault();
      e.stopPropagation();
      setShowModal(true);
    }
  };

  return (
    <>
      <div onClickCapture={handleClick} className="contents shadow-none">
        {children}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="relative h-32 bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center shadow-none">
              <div className="absolute top-4 right-4 shadow-none">
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors shadow-none"
                >
                  <X className="w-5 h-5 shadow-none" />
                </button>
              </div>
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
                <ShieldAlert className="w-8 h-8 text-primary-600 shadow-none" />
              </div>
            </div>

            {/* Content */}
            <div className="p-8 text-center shadow-none">
              <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2 shadow-none">
                {isBanned ? t("accountRestricted") : t("verificationRequired")}
              </h2>
              <p className="text-gray-500 mb-8 shadow-none">
                {isBanned ? t("bannedDesc") : t("verificationDesc")}
              </p>

              <div className="space-y-4 mb-8 shadow-none">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left shadow-none">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-none ${session?.user?.isPhoneVerified ? 'bg-green-100 text-green-600' : 'bg-primary-100 text-primary-600'}`}>
                    {session?.user?.isPhoneVerified ? <CheckCircle className="w-6 h-6 shadow-none" /> : <Smartphone className="w-6 h-6 shadow-none" />}
                  </div>
                  <div className="flex-1 shadow-none">
                    <p className="font-semibold text-gray-900 text-sm shadow-none">{t("phoneVerification")}</p>
                    <p className="text-xs text-gray-500 shadow-none">{session?.user?.isPhoneVerified ? t("verified") : t("phoneRecommended")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left shadow-none">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-none ${session?.user?.emailVerified ? 'bg-green-100 text-green-600' : 'bg-accent-100 text-accent-600'}`}>
                    {session?.user?.emailVerified ? <CheckCircle className="w-6 h-6 shadow-none" /> : <Mail className="w-6 h-6 shadow-none" />}
                  </div>
                  <div className="flex-1 shadow-none">
                    <p className="font-semibold text-gray-900 text-sm shadow-none">{t("emailVerification")}</p>
                    <p className="text-xs text-gray-500 shadow-none">{session?.user?.emailVerified ? t("verified") : t("emailRequired")}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 shadow-none">
                <Link
                  href="/profile"
                  onClick={() => setShowModal(false)}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2"
                >
                  {t("verifyNow")}
                </Link>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 text-gray-400 font-medium text-sm hover:text-gray-600 transition-colors shadow-none"
                >
                  {t("maybeLater")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
