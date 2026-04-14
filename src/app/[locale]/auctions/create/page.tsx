"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createAuction } from "@/actions/auction";
import { CATEGORIES, LOCATIONS } from "@/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  MapPin,
  Smartphone,
} from "lucide-react";
import { ImageUpload } from "@/components/upload/ImageUpload";
import { VerificationGuard } from "@/components/auth/VerificationGuard";
import { useTranslations } from "next-intl";

type Step = "details" | "pricing" | "schedule" | "review";

export default function CreateAuctionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("Auction");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    title: "",
    description: "",
    images: [],
    category: "electronics",
    startingPrice: 100,
    minBidIncrement: 10,
    startTime: "",
    endTime: "",
    location: "mirpur",
    reservePrice: undefined as number | undefined,
    buyItNowPrice: undefined as number | undefined,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const steps: Step[] = ["details", "pricing", "schedule", "review"];
  const stepIndex = steps.indexOf(step);

  const handleSubmit = () => {
    setError("");
    startTransition(async () => {
      const result = await createAuction({
        ...form,
        images: form.images.filter(Boolean),
      });
      if (result.success && result.auction) {
        router.push(`/auctions/${result.auction.id}`);
      } else {
        setError(result.error || "Failed to create auction.");
        if (result.error === "PHONE_NOT_VERIFIED") {
          setError(
            "Please verify your phone number before selling. Go to your Profile to verify.",
          );
        }
      }
    });
  };

  const updateForm = (field: string, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading font-bold text-2xl text-gray-900 mb-2">
        {t("createTitle")}
      </h1>
      <p className="text-sm text-gray-500 mb-8">{t("createSubtitle")}</p>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= stepIndex
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 ${i < stepIndex ? "bg-primary-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Step: Details */}
        {step === "details" && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">
              {t("details")}
            </h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemTitle")}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="e.g., iPhone 15 Pro Max 256GB"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemDesc")}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Describe your item in detail..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemCat")}
              </label>
              <select
                value={form.category}
                onChange={(e) => updateForm("category", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemLoc")}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={form.location}
                  onChange={(e) => updateForm("location", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none appearance-none"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemImages")}
              </label>
              <ImageUpload
                value={form.images}
                onChange={(urls: string[]) => updateForm("images", urls)}
                onRemove={(url: string) =>
                  updateForm(
                    "images",
                    form.images.filter((current) => current !== url),
                  )
                }
              />
            </div>
          </div>
        )}

        {/* Step: Pricing */}
        {step === "pricing" && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">
              {t("pricing")}
            </h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("startPrice")}
              </label>
              <input
                type="number"
                value={form.startingPrice}
                onChange={(e) =>
                  updateForm("startingPrice", Number(e.target.value))
                }
                min={1}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm price focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("minIncrement")}
              </label>
              <input
                type="number"
                value={form.minBidIncrement}
                onChange={(e) =>
                  updateForm("minBidIncrement", Number(e.target.value))
                }
                min={1}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm price focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Each new bid must be at least this much higher than the current
                price.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="text-xs font-medium text-gray-900 mb-2 block">
                Optional Upgrades
              </label>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1 block">
                    {t("reservePrice")}
                  </label>
                  <input
                    type="number"
                    value={form.reservePrice ?? ""}
                    onChange={(e) =>
                      updateForm(
                        "reservePrice",
                        e.target.value
                          ? Number(e.target.value)
                          : (undefined as unknown as number),
                      )
                    }
                    placeholder="Hidden minimum price..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Item won&apos;t sell unless bidding reaches this amount.
                  </p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1 block">
                    {t("buyNowPrice")}
                  </label>
                  <input
                    type="number"
                    value={form.buyItNowPrice ?? ""}
                    onChange={(e) =>
                      updateForm(
                        "buyItNowPrice",
                        e.target.value
                          ? Number(e.target.value)
                          : (undefined as unknown as number),
                      )
                    }
                    placeholder="Instant purchase price..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Allow buyers to skip bidding and buy instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Schedule */}
        {step === "schedule" && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">
              {t("schedule")}
            </h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("startTime")}
              </label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => updateForm("startTime", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("endTime")}
              </label>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => updateForm("endTime", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                {t("antiSnipeNote")}
              </p>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">
              {t("reviewTitle")}
            </h2>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <div>
                <strong className="text-gray-700">{t("itemTitle")}:</strong>{" "}
                <span className="text-gray-600">{form.title}</span>
              </div>
              <div>
                <strong className="text-gray-700">{t("itemCat")}:</strong>{" "}
                <span className="text-gray-600">{form.category}</span>
              </div>
              <div>
                <strong className="text-gray-700">{t("itemLoc")}:</strong>{" "}
                <span className="text-gray-600 uppercase font-semibold">
                  {form.location}
                </span>
              </div>
              <div>
                <strong className="text-gray-700">{t("startPrice")}:</strong>{" "}
                <span className="price text-primary-700">
                  ৳{form.startingPrice}
                </span>
              </div>
              {form.reservePrice && (
                <div>
                  <strong className="text-gray-700">{t("reservePrice")}:</strong>{" "}
                  <span className="price text-gray-600">
                    ৳{form.reservePrice}
                  </span>
                </div>
              )}
              {form.buyItNowPrice && (
                <div>
                  <strong className="text-gray-700">{t("buyNowPrice")}:</strong>{" "}
                  <span className="price text-accent-600">
                    ৳{form.buyItNowPrice}
                  </span>
                </div>
              )}
              <div>
                <strong className="text-gray-700">{t("minIncrement")}:</strong>{" "}
                <span className="price text-gray-600">
                  ৳{form.minBidIncrement}
                </span>
              </div>
              <div>
                <strong className="text-gray-700">সময়সীমা:</strong>{" "}
                <span className="text-gray-600">
                  {form.startTime} → {form.endTime}
                </span>
              </div>
              <div>
                <strong className="text-gray-700">{t("itemImages")}:</strong>{" "}
                <span className="text-gray-600">
                  {form.images.filter(Boolean).length} uploaded
                </span>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
              {t("publishNote")}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => stepIndex > 0 && setStep(steps[stepIndex - 1])}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> {t("backBtn")}
          </button>

          {step === "review" ? (
            <VerificationGuard>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2"
              >
                {isPending ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  t("publishBtn")
                )}
              </button>
            </VerificationGuard>
          ) : (
            <button
              onClick={() => setStep(steps[stepIndex + 1])}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all flex items-center gap-1"
            >
              {t("nextBtn")} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
