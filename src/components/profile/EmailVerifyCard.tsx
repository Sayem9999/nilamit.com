"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { sendEmailVerificationOTP, verifyEmailOTP } from "@/actions/verification";
import { Mail, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export function EmailVerifyCard() {
  const { data: session, update } = useSession();
  const t = useTranslations("Profile");
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const emailVerified = Boolean((session?.user as { emailVerified?: Date | null } | undefined)?.emailVerified);
  const email = session?.user?.email ?? "";

  if (emailVerified) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-heading font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-600" aria-hidden="true" /> {t("emailVerification")}
        </h2>
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          <span>
            {t("emailVerifiedOn")} <strong>{email}</strong>
          </span>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await sendEmailVerificationOTP();
      if (res.success) {
        setStep("sent");
        setMsg({ kind: "ok", text: t("emailOtpSent") });
      } else {
        setMsg({ kind: "err", text: res.error || t("errorGeneric") });
      }
    });
  };

  const handleVerify = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await verifyEmailOTP(code.trim());
      if (res.success) {
        setMsg({ kind: "ok", text: t("emailVerifySuccess") });
        await update();
      } else {
        setMsg({ kind: "err", text: res.error || t("errorGeneric") });
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <h2 className="font-heading font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
        <Mail className="w-5 h-5 text-primary-600" aria-hidden="true" /> {t("emailVerification")}
      </h2>
      <p className="text-xs text-gray-500 mb-4">{t("emailVerifyDesc")}</p>

      {step === "idle" ? (
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !email}
          aria-busy={isPending}
          className="w-full bg-primary-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary-700 disabled:bg-gray-200 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">{t("sendEmailOTP")}</span>
            </>
          ) : (
            t("sendEmailOTP")
          )}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <label htmlFor="email-otp" className="sr-only">{t("enterEmailOTP")}</label>
          <input
            id="email-otp"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("enterEmailOTP")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="flex-1 border border-gray-200 text-gray-600 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {t("resendBtn")}
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={isPending || code.trim().length !== 6}
              aria-busy={isPending}
              className="flex-1 bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-bold disabled:bg-gray-200 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline" aria-hidden="true" />
                  <span className="sr-only">{t("verifyBtn")}</span>
                </>
              ) : (
                t("verifyBtn")
              )}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className={`mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
            msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.kind === "err" && <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
