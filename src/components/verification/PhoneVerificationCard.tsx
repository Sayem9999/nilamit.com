"use client";

/**
 * Firebase phone-OTP verification card (client half).
 *
 * Uses Firebase Auth Phone sign-in as the OTP rail: invisible reCAPTCHA →
 * Firebase sends the SMS → user enters the 6-digit code → the phone number is
 * LINKED to the session-bound Firebase user (ensureFirebaseAuth signs in with
 * a custom token whose UID === the NextAuth user id). A fresh ID token then
 * goes to confirmPhoneVerification(), which verifies it server-side and flips
 * users/{uid}.isPhoneVerified.
 *
 * Graceful degradation: if the Phone provider isn't enabled in Firebase
 * Console yet, Firebase throws auth/operation-not-allowed and we show a
 * clear "not available yet" message — nothing else breaks.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { Smartphone, Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  unlink,
  type ConfirmationResult,
} from "firebase/auth";
import { getClientAuth, ensureFirebaseAuth } from "@/lib/firebase-client";
import { normalizeBdPhone, maskPhone } from "@/lib/phone";
import {
  getPhoneVerificationStatus,
  confirmPhoneVerification,
} from "@/actions/phone-verification";

type Step = "loading" | "verified" | "enter-phone" | "enter-code";

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/operation-not-allowed":
    "Phone sign-in isn't enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method → Phone.",
  "auth/too-many-requests":
    "Too many attempts from this device. Please try again later.",
  "auth/invalid-phone-number": "That phone number doesn't look valid.",
  "auth/missing-phone-number": "Enter a phone number first.",
  "auth/invalid-verification-code": "Wrong code — please check the SMS and try again.",
  "auth/code-expired": "That code expired. Request a new one.",
  "auth/account-exists-with-different-credential":
    "This phone number is already linked to another account.",
  "auth/credential-already-in-use":
    "This phone number is already verified on another account.",
  "auth/provider-already-linked":
    "A phone number is already linked — reload the page and try again.",
  // Config-level failures (surface the cause so it's actionable):
  "auth/unauthorized-domain":
    "This domain isn't authorized for phone sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.",
  "auth/captcha-check-failed":
    "reCAPTCHA verification failed. Reload the page and try again.",
  "auth/billing-not-enabled":
    "SMS sign-in requires the Blaze plan to be active on the Firebase project.",
  "auth/quota-exceeded": "The SMS quota has been reached. Please try again later.",
  "auth/app-not-authorized":
    "This app isn't authorized to use Firebase Authentication with the provided API key.",
  "auth/internal-error":
    "Authentication service error. If this persists, check that reCAPTCHA/App Check aren't blocking the request.",
};

function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code];
  // Surface the raw code/message for unmapped failures so issues are diagnosable
  // in the field instead of a dead-end "Something went wrong".
  const raw = code || (err as { message?: string })?.message || "unknown error";
  return `Couldn't complete phone verification (${raw}). Please try again.`;
}

export function PhoneVerificationCard() {
  const [step, setStep] = useState<Step>("loading");
  const [verifiedNumber, setVerifiedNumber] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await getPhoneVerificationStatus();
      if (res.success && res.data?.isPhoneVerified) {
        setVerifiedNumber(res.data.phoneNumber);
        setStep("verified");
      } else {
        setStep("enter-phone");
      }
    })();
    // Tear down the reCAPTCHA widget on unmount so re-renders don't stack them.
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const handleSendCode = async () => {
    const e164 = normalizeBdPhone(phoneInput);
    if (!e164) {
      toast.error("Enter a valid Bangladeshi mobile number (e.g. 01712345678).");
      return;
    }
    setSending(true);
    try {
      await ensureFirebaseAuth();
      const auth = getClientAuth();
      const user = auth.currentUser;
      if (!user) {
        // Custom-token sign-in (ensureFirebaseAuth → /api/firebase/token) didn't
        // complete — phone linking needs a signed-in Firebase user.
        toast.error("Couldn't establish a secure session. Reload the page and sign in again.");
        return;
      }

      // Re-verification: a phone provider from a previous attempt must be
      // unlinked before a new number can be linked.
      if (user.providerData.some((p) => p.providerId === "phone")) {
        await unlink(user, "phone");
      }

      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, "phone-recaptcha-anchor", {
          size: "invisible",
        });
        // Pre-render the invisible widget. Without an explicit render(), the
        // first linkWithPhoneNumber() can intermittently fail/hang before the
        // reCAPTCHA token is ready — a common production-only flake.
        await recaptchaRef.current.render();
      }

      confirmationRef.current = await linkWithPhoneNumber(user, e164, recaptchaRef.current);
      setStep("enter-code");
      toast.success(`Code sent to ${e164}`);
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
      // A consumed reCAPTCHA can't be reused — reset for the next attempt.
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSending(false);
    }
  };

  const handleConfirmCode = () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from the SMS.");
      return;
    }
    startTransition(async () => {
      try {
        const confirmation = confirmationRef.current;
        if (!confirmation) {
          toast.error("Session expired — request a new code.");
          setStep("enter-phone");
          return;
        }
        await confirmation.confirm(code);

        // Phone is now linked in Firebase. Prove it to the server with a
        // fresh ID token (forceRefresh so the phone_number claim is present).
        const auth = getClientAuth();
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) throw new Error("Could not get ID token");

        const res = await confirmPhoneVerification(idToken);
        if (res.success && res.data) {
          setVerifiedNumber(res.data.phoneNumber);
          setStep("verified");
          toast.success("Phone number verified!");
        } else {
          toast.error(res.error?.message || "Verification failed");
        }
      } catch (err) {
        toast.error(firebaseErrorMessage(err));
      }
    });
  };

  if (step === "loading") {
    return (
      <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Loading phone verification…</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md p-6 border border-gray-100 shadow-sm space-y-4">
      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
        <Smartphone size={18} className="text-primary-600" /> Phone Verification
      </h3>

      {step === "verified" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-900">
              Verified{verifiedNumber ? ` — ${maskPhone(verifiedNumber)}` : ""}
            </p>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              Your number is confirmed via SMS. Buyers and sellers see a higher
              trust signal on your profile.
            </p>
          </div>
        </div>
      ) : step === "enter-phone" ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">
            Verify your mobile number with a one-time SMS code. Verified
            accounts get a trust badge and faster dispute resolution.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="01712345678"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
            />
            <button
              onClick={handleSendCode}
              disabled={sending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-md transition-colors flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Enter the 6-digit code we sent by SMS.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono tracking-[0.4em] text-center focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
            />
            <button
              onClick={handleConfirmCode}
              disabled={isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-md transition-colors flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <><ShieldCheck className="w-4 h-4" /> Verify</>
              )}
            </button>
          </div>
          <button
            onClick={() => { setStep("enter-phone"); setCode(""); }}
            className="text-xs font-bold text-primary-600 hover:text-primary-700"
          >
            Use a different number
          </button>
        </div>
      )}

      {/* Invisible reCAPTCHA anchor — Firebase renders its widget here. */}
      <div id="phone-recaptcha-anchor" />
    </div>
  );
}
