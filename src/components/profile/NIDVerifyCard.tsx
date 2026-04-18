"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { submitNIDVerification, getMyNIDStatus } from "@/actions/verification";
import { uploadFile } from "@/lib/uploadthing";
import {
  FileCheck2, Upload, Loader2, AlertCircle, CheckCircle,
  Clock, XCircle, ImagePlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { NIDStatus } from "@/types";

type LocalStatus = {
  status: NIDStatus;
  last4: string | null;
  rejectionReason: string | null;
  isNIDVerified: boolean;
};

export function NIDVerifyCard() {
  const { data: session } = useSession();
  const t = useTranslations("Profile");
  const [isPending, startTransition] = useTransition();
  const [local, setLocal] = useState<LocalStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [nidNumber, setNidNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [uploadingSide, setUploadingSide] = useState<"front" | "back" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await getMyNIDStatus();
      if (!mounted) return;
      if (res.success) {
        setLocal({
          status: res.status ?? NIDStatus.NONE,
          last4: res.last4 ?? null,
          rejectionReason: res.rejectionReason ?? null,
          isNIDVerified: Boolean(res.isNIDVerified),
        });
      }
      setLoadingStatus(false);
    })();
    return () => { mounted = false; };
  }, [session?.user]);

  const handleSubmit = () => {
    setMsg(null);

    if (!frontFile || !backFile) {
      setMsg({ kind: "err", text: t("nidBothPhotosRequired") });
      return;
    }
    const cleanedNid = nidNumber.replace(/\s+/g, "");
    if (!/^\d{10}$|^\d{13}$|^\d{17}$/.test(cleanedNid)) {
      setMsg({ kind: "err", text: t("nidInvalidNumber") });
      return;
    }

    startTransition(async () => {
      try {
        setUploadingSide("front");
        const frontPath = await uploadFile(frontFile, "nid");
        setUploadingSide("back");
        const backPath = await uploadFile(backFile, "nid");
        setUploadingSide(null);

        const res = await submitNIDVerification({
          nidNumber: cleanedNid,
          frontPath,
          backPath,
        });
        if (res.success) {
          setMsg({ kind: "ok", text: t("nidSubmitted") });
          setLocal({
            status: NIDStatus.PENDING,
            last4: cleanedNid.slice(-4),
            rejectionReason: null,
            isNIDVerified: false,
          });
          setFrontFile(null);
          setBackFile(null);
          setNidNumber("");
        } else {
          setMsg({ kind: "err", text: res.error || t("errorGeneric") });
        }
      } catch (e) {
        setUploadingSide(null);
        setMsg({ kind: "err", text: e instanceof Error ? e.message : t("errorGeneric") });
      }
    });
  };

  const status = local?.status ?? NIDStatus.NONE;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <h2 className="font-heading font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
        <FileCheck2 className="w-5 h-5 text-primary-600" aria-hidden="true" /> {t("nidTitle")}
      </h2>
      <p className="text-xs text-gray-500 mb-4">{t("nidDesc")}</p>

      {loadingStatus ? (
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{t("loadingStatus")}</span>
        </div>
      ) : status === NIDStatus.APPROVED ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-green-700 text-sm">
          <CheckCircle className="w-5 h-5" aria-hidden="true" />
          <span>
            {t("nidApproved")}{local?.last4 ? ` · NID ••••${local.last4}` : ""}
          </span>
        </div>
      ) : status === NIDStatus.PENDING ? (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-amber-700 text-sm">
          <Clock className="w-5 h-5" aria-hidden="true" />
          <span>{t("nidPending")}</span>
        </div>
      ) : (
        <>
          {status === NIDStatus.REJECTED && local?.rejectionReason && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-700 text-sm mb-4"
            >
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold mb-0.5">{t("nidRejected")}</p>
                <p className="text-xs">{local.rejectionReason}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="nid-number" className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">
                {t("nidNumberLabel")}
              </label>
              <input
                id="nid-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={nidNumber}
                onChange={(e) => setNidNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                placeholder={t("nidNumberPlaceholder")}
                maxLength={17}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">{t("nidNumberHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NIDUploadSlot
                label={t("nidFrontLabel")}
                file={frontFile}
                onChange={setFrontFile}
                busy={uploadingSide === "front"}
                disabled={isPending}
              />
              <NIDUploadSlot
                label={t("nidBackLabel")}
                file={backFile}
                onChange={setBackFile}
                busy={uploadingSide === "back"}
                disabled={isPending}
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !frontFile || !backFile || !nidNumber}
              aria-busy={isPending}
              className="w-full bg-primary-600 text-white px-4 py-3 rounded-xl text-sm font-bold disabled:bg-gray-200 hover:bg-primary-700 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t("nidSubmitting")}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  {t("nidSubmitBtn")}
                </>
              )}
            </button>

            <p className="text-[11px] text-gray-400">
              {t("nidPrivacyHint")}
            </p>
          </div>
        </>
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

function NIDUploadSlot({
  label,
  file,
  onChange,
  busy,
  disabled,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  busy: boolean;
  disabled: boolean;
}) {
  const inputId = `nid-upload-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label
      htmlFor={inputId}
      className={`relative flex flex-col items-center justify-center gap-2 aspect-[4/3] border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
        file ? "border-primary-500 bg-primary-50/30" : "border-gray-200 hover:border-gray-300 bg-gray-50"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {busy ? (
        <>
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" aria-hidden="true" />
          <span className="text-[10px] font-bold text-primary-700">Uploading…</span>
        </>
      ) : file ? (
        <>
          <CheckCircle className="w-6 h-6 text-primary-600" aria-hidden="true" />
          <span className="text-[10px] font-bold text-primary-700 truncate px-2">
            {file.name}
          </span>
        </>
      ) : (
        <>
          <ImagePlus className="w-6 h-6 text-gray-400" aria-hidden="true" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {label}
          </span>
        </>
      )}
    </label>
  );
}
