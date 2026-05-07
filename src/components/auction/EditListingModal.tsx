"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { ImageUpload } from "@/components/upload/ImageUpload";
import { editAuction } from "@/actions/auction";

interface EditListingModalProps {
  auctionId: string;
  initialDescription: string;
  initialImages: string[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const DESC_MIN = 10;
const DESC_MAX = 5000;
const IMG_MIN = 1;
const IMG_MAX = 10;

export function EditListingModal({
  auctionId,
  initialDescription,
  initialImages,
  isOpen,
  onClose,
  onSaved,
}: EditListingModalProps) {
  const t = useTranslations("Owner");
  const [description, setDescription] = useState(initialDescription);
  const [images, setImages] = useState<string[]>(initialImages);
  const [errors, setErrors] = useState<{ description?: string; images?: string }>({});
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Re-sync local state when the modal re-opens with potentially new server data.
  // setState-in-effect is intentional: the modal's draft fields must reset to
  // the server's current values each time it's opened (after router.refresh()
  // surfaces edits / bid races).
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDescription(initialDescription);
      setImages(initialImages);
      setErrors({});
    }
  }, [isOpen, initialDescription, initialImages]);

  // Escape closes; also trap focus to the dialog while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isPending, onClose]);

  const descLen = description.length;
  const isDirty = useMemo(() => {
    const descChanged = description !== initialDescription;
    const imagesChanged =
      images.length !== initialImages.length ||
      images.some((url, i) => url !== initialImages[i]);
    return descChanged || imagesChanged;
  }, [description, images, initialDescription, initialImages]);

  const counterColor =
    descLen >= DESC_MAX ? "text-red-600" :
    descLen >= 4500    ? "text-amber-600" :
                         "text-gray-400";

  const validate = () => {
    const next: typeof errors = {};
    if (descLen < DESC_MIN) next.description = t("errDescriptionMin", { min: DESC_MIN });
    if (descLen > DESC_MAX) next.description = t("errDescriptionMax", { max: DESC_MAX });
    if (images.length < IMG_MIN) next.images = t("errImageMin");
    if (images.length > IMG_MAX) next.images = t("errImageMax", { max: IMG_MAX });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (isPending || !isDirty) return;
    if (!validate()) return;

    const patch: { auctionId: string; description?: string; images?: string[] } = { auctionId };
    if (description !== initialDescription) patch.description = description;
    if (
      images.length !== initialImages.length ||
      images.some((url, i) => url !== initialImages[i])
    ) {
      patch.images = images;
    }

    startTransition(async () => {
      const res = await editAuction(patch);
      if (res.success) {
        toast.success(t("listingUpdated"));
        onSaved?.();
        onClose();
        return;
      }

      const msg = res.error?.message ?? "";
      // Race: someone bid between modal open and submit. Tell the user, refresh.
      if (msg.includes("Cannot edit after bids")) {
        toast.error(t("editRaceMessage"), { duration: 5000 });
        onSaved?.();
        onClose();
        return;
      }
      toast.error(msg || t("editFailed"));
    });
  };

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-listing-title"
      aria-describedby="edit-listing-hint"
      onClick={() => { if (!isPending) onClose(); }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-3 border-b border-gray-100">
          <div>
            <h2 id="edit-listing-title" className="text-lg font-heading font-bold text-gray-900 mb-1">
              {t("editTitle")}
            </h2>
            <p id="edit-listing-hint" className="text-xs text-gray-500 leading-relaxed max-w-md">
              {t("editHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { if (!isPending) onClose(); }}
            disabled={isPending}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrolls when content overflows on small screens */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="edit-desc" className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {t("descLabel")}
              </label>
              <span className={`text-[10px] font-mono ${counterColor}`}>
                {descLen.toLocaleString()} / {DESC_MAX.toLocaleString()}
              </span>
            </div>
            <textarea
              id="edit-desc"
              autoFocus
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((p) => ({ ...p, description: undefined }));
              }}
              rows={6}
              maxLength={DESC_MAX}
              disabled={isPending}
              className={`w-full border rounded-xl p-3 text-sm resize-none outline-none transition-colors ${
                errors.description
                  ? "border-red-400 focus:ring-2 focus:ring-red-200"
                  : "border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              } disabled:bg-gray-50 disabled:cursor-not-allowed`}
              placeholder={t("descPlaceholder")}
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1.5">{errors.description}</p>
            )}
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {t("photosLabel")}
              </label>
              <span className="text-[10px] font-mono text-gray-400">
                {images.length} / {IMG_MAX}
              </span>
            </div>
            <ImageUpload
              value={images}
              onChange={setImages}
              onRemove={handleRemoveImage}
            />
            {errors.images && (
              <p className="text-xs text-red-600 mt-1.5">{errors.images}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[11px] text-gray-400 leading-tight max-w-[40%]">
            {isDirty ? t("unsavedChanges") : t("noChanges")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (!isPending) onClose(); }}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-white rounded-xl transition-colors disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !isDirty}
              className="px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
