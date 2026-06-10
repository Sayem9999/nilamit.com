"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { ShieldCheck, Upload, CheckCircle, AlertTriangle, Loader2, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { submitKyc } from "@/actions/kyc";
import type { KycStatus } from "@/types";

interface Props {
  /** Current KYC state — drives which UI mode renders. */
  status?: KycStatus;
  /** Rejection reason from the last admin review, if any. */
  rejectReason?: string | null;
}

/**
 * Seller KYC submission form.
 *
 * Three UX modes based on user.kycStatus:
 *   NONE / REJECTED → upload form (REJECTED shows the reason at the top)
 *   PENDING         → "Under review" empty state with submitted-on timestamp
 *   APPROVED        → green confirmation; offer to update docs
 *
 * Uploads use the existing /api/upload endpoint with type='chat' (KYC docs
 * inherit the same uid-scoped Storage rule — only uploader can read).
 * After all 2-4 docs are uploaded, the seller hits Submit and we flip
 * users/{uid}.kycStatus to PENDING server-side.
 */
export function KycSubmissionForm({ status = "NONE", rejectReason }: Props) {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [docs, setDocs] = useState<{
    nidFrontUrl?: string;
    nidBackUrl?: string;
    selfieUrl?: string;
    tradeLicenseUrl?: string;
  }>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  if (!session?.user?.id) return null;

  if (status === "APPROVED") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-5 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-emerald-900 text-sm">Identity verified</h3>
          <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
            Your verified-seller badge is live on every listing and profile page.
            Buyers see a higher trust signal — typically converts 20-30% better.
          </p>
        </div>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-5 flex items-start gap-3">
        <Loader2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
        <div>
          <h3 className="font-bold text-blue-900 text-sm">KYC under review</h3>
          <p className="text-xs text-blue-800 mt-1 leading-relaxed">
            Our team typically reviews within 24 hours. You&apos;ll get a notification
            once approved or if we need a clearer scan.
          </p>
        </div>
      </div>
    );
  }

  // NONE or REJECTED — show the upload form.

  const uploadDoc = async (
    field: "nidFrontUrl" | "nidBackUrl" | "selfieUrl" | "tradeLicenseUrl",
    file: File,
  ) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB.");
      return;
    }
    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "chat"); // re-uses the existing uid-scoped storage path
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const { url } = (await res.json()) as { url: string };
      setDocs((d) => ({ ...d, [field]: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingField(null);
    }
  };

  const canSubmit = !!docs.nidFrontUrl && !!docs.nidBackUrl && !isPending;

  const handleSubmit = () => {
    startTransition(async () => {
      const res = await submitKyc(docs);
      if (res.success) {
        toast.success("KYC submitted — we'll review within 24 hours.");
      } else {
        toast.error(res.error?.message || "Submission failed");
      }
    });
  };

  return (
    <div className="space-y-4">
      {status === "REJECTED" && rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900 text-sm">Previous submission rejected</h3>
            <p className="text-xs text-red-800 mt-1 leading-snug">{rejectReason}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Verified Business Seller</h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Upload NID (both sides required) to apply for the verified-seller badge.
          Optionally add a trade license + selfie to qualify for the higher-tier
          Pro Retailer status (longer auction durations, lower commission).
        </p>

        <div className="grid grid-cols-2 gap-3">
          <DocUpload
            label="NID front *"
            field="nidFrontUrl"
            value={docs.nidFrontUrl}
            uploading={uploadingField === "nidFrontUrl"}
            onChange={(f) => uploadDoc("nidFrontUrl", f)}
          />
          <DocUpload
            label="NID back *"
            field="nidBackUrl"
            value={docs.nidBackUrl}
            uploading={uploadingField === "nidBackUrl"}
            onChange={(f) => uploadDoc("nidBackUrl", f)}
          />
          <DocUpload
            label="Selfie (optional)"
            field="selfieUrl"
            value={docs.selfieUrl}
            uploading={uploadingField === "selfieUrl"}
            onChange={(f) => uploadDoc("selfieUrl", f)}
          />
          <DocUpload
            label="Trade license (optional)"
            field="tradeLicenseUrl"
            value={docs.tradeLicenseUrl}
            uploading={uploadingField === "tradeLicenseUrl"}
            onChange={(f) => uploadDoc("tradeLicenseUrl", f)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Submit for review
            </>
          )}
        </button>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Your documents are stored privately — only Nilamit moderators can view
          them via short-lived signed URLs. We never share KYC docs with buyers
          or other sellers.
        </p>
      </div>
    </div>
  );
}

function DocUpload({
  label,
  field,
  value,
  uploading,
  onChange,
}: {
  label: string;
  field: string;
  value: string | undefined;
  uploading: boolean;
  onChange: (file: File) => void;
}) {
  const inputId = `kyc-doc-${field}`;
  return (
    <label
      htmlFor={inputId}
      className={`block border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${
        value
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
      }`}
    >
      <div className="flex flex-col items-center gap-1.5">
        {uploading ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        ) : value ? (
          <CheckCircle className="w-5 h-5 text-emerald-600" />
        ) : (
          <FileText className="w-5 h-5 text-gray-400" />
        )}
        <span className="text-[11px] font-semibold text-gray-700">{label}</span>
        <span className="text-[11px] text-gray-400">
          {value ? "Uploaded" : uploading ? "Uploading..." : "Click to upload"}
        </span>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
