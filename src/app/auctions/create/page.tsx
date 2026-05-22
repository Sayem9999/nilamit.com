"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { createAuction } from "@/actions/auction";
import { getSmartPricingSuggestion } from "@/actions/pricing";
import type { SmartPricingResult } from "@/services/pricing/pricing-service";
import { CATEGORIES, LOCATIONS } from "@/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  MapPin,
  Sparkles,
  TrendingUp,
  Info,
} from "lucide-react";
import { ImageUpload } from "@/components/upload/ImageUpload";
import { VerificationGuard } from "@/components/auth/VerificationGuard";
import { useTranslations } from "next-intl";

type Step = "details" | "pricing" | "schedule" | "review";

export default function CreateAuctionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const _locale = useLocale();
  const t = useTranslations("Auction");
  const tCat = useTranslations("Categories");
  const tLoc = useTranslations("Locations");
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
    condition: "USED" as 'NEW' | 'USED' | 'REFURBISHED',
  });
  const [suggestion, setSuggestion] = useState<SmartPricingResult | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [debouncedTitle, setDebouncedTitle] = useState(form.title);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTitle(form.title);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [form.title]);

  useEffect(() => {
    if (step === "pricing") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingSuggestion(true);
      getSmartPricingSuggestion(form.category, form.condition, debouncedTitle).then((res) => {
        if (res.success && res.data) {
          setSuggestion(res.data);
        } else {
          setSuggestion(null);
        }
        setLoadingSuggestion(false);
      });
    }
  }, [form.category, form.condition, debouncedTitle, step]);

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
      if (result.success && result.data?.auctionId) {
        router.push(`/auctions/${result.data.auctionId}`);
      } else {
        setError(result.error?.message || t("createAuctionFailed"));
      }
    });
  };

  const updateForm = (field: string, value: string | number | string[] | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-heading font-bold text-2xl text-gray-900">
          {t("createTitle")}
        </h1>
        {session.user.isVerifiedSeller && (
          <Link 
            href={`/seller/inventory/bulk`}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100 transition-all"
          >
            Switch to Bulk Upload
          </Link>
        )}
      </div>
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
                name="title"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder={t("itemTitlePlaceholder")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemDesc")}
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder={t("itemDescPlaceholder")}
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemCat")}
              </label>
              <select
                name="category"
                value={form.category}
                onChange={(e) => updateForm("category", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.icon} {tCat(cat.slug)}
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
                      {tLoc(loc.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("itemCondition") || "Item Condition"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['NEW', 'USED', 'REFURBISHED'].map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => updateForm("condition", cond)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                      form.condition === cond 
                        ? "bg-primary-50 border-primary-200 text-primary-700 shadow-sm" 
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {cond}
                  </button>
                ))}
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

            {/* Smart Pricing Suggestion UI */}
            {step === "pricing" && (
              <div className="mb-6">
                {loadingSuggestion ? (
                  <div className="flex items-center gap-2 text-xs text-primary-600 bg-primary-50 p-3 rounded-xl animate-pulse">
                    <span className="w-4 h-4 rounded-full border-2 border-primary-300 border-t-primary-600 animate-spin" />
                    Analyzing market trends...
                  </div>
                ) : suggestion ? (
                  <div className="bg-gradient-to-br from-primary-50/40 via-white to-primary-50/10 border border-primary-100/80 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary-100/60 text-primary-600">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold text-sm text-gray-900">
                            Smart Pricing Engine
                          </h3>
                          <p className="text-[10px] text-gray-500">Real-time market analysis powered by Nilamit AI</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                          suggestion.demandLevel === 'HIGH'
                            ? "bg-violet-50 text-violet-700 border-violet-100"
                            : suggestion.demandLevel === 'MODERATE'
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-gray-50 text-gray-500 border-gray-100"
                        }`}>
                          <TrendingUp className="w-3 h-3" />
                          {suggestion.demandLevel} DEMAND
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                          suggestion.confidence === 'HIGH'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : suggestion.confidence === 'MEDIUM'
                            ? "bg-sky-50 text-sky-700 border-sky-100"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          {suggestion.confidence} CONFIDENCE
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                      Based on <strong className="text-gray-900">{suggestion.dataPoints} recently sold {tCat(form.category || 'electronics').toLowerCase()}</strong>, here are our recommended price settings. Click a suggestion to apply it instantly.
                    </p>

                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => updateForm("startingPrice", suggestion.suggestedStart)}
                        className="group relative text-left bg-white p-3.5 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Suggested Start Price</div>
                        <div className="text-lg font-extrabold text-primary-600 group-hover:text-primary-700 flex items-baseline gap-0.5">
                          <span className="text-xs font-semibold">৳</span>{suggestion.suggestedStart.toLocaleString()}
                        </div>
                        <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-500">
                          <Check className="w-4 h-4" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateForm("buyItNowPrice", suggestion.suggestedBuyNow)}
                        className="group relative text-left bg-white p-3.5 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Suggested Buy-Now</div>
                        <div className="text-lg font-extrabold text-primary-600 group-hover:text-primary-700 flex items-baseline gap-0.5">
                          <span className="text-xs font-semibold">৳</span>{suggestion.suggestedBuyNow.toLocaleString()}
                        </div>
                        <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary-500">
                          <Check className="w-4 h-4" />
                        </div>
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3.5 border-t border-gray-100/60 text-[10px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                        <span>Average bids per sold listing: <strong>{suggestion.avgBids}</strong></span>
                      </div>
                      <div>
                        <span>Expected final value: <strong>৳{suggestion.expectedFinal.toLocaleString()}</strong></span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {t("startPrice")}
              </label>
              <input
                type="number"
                name="startingPrice"
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
                name="minBidIncrement"
                value={form.minBidIncrement}
                onChange={(e) =>
                  updateForm("minBidIncrement", Number(e.target.value))
                }
                min={1}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm price focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                {t("minIncrementDesc") || "Each new bid must be at least this much higher than the current price."}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-900 mb-2 block uppercase tracking-widest">
                {t("optionalUpgrades")}
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
                          : undefined,
                      )
                    }
                    placeholder={t("reservePricePlaceholder")}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t("reservePriceDesc") || "Item won't sell unless bidding reaches this amount."}
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
                          : undefined,
                      )
                    }
                    placeholder={t("buyNowPricePlaceholder")}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t("buyNowPriceDesc") || "Allow buyers to skip bidding and buy instantly."}
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
                name="startTime"
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
                name="endTime"
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
                <span className="text-gray-600">{tCat(form.category)}</span>
              </div>
              <div>
                <strong className="text-gray-700">{t("itemLoc")}:</strong>{" "}
                <span className="text-gray-600 uppercase font-semibold">
                  {tLoc(form.location)}
                </span>
              </div>
              <div>
                <strong className="text-gray-700">{t("itemCondition") || "Condition"}:</strong>{" "}
                <span className="text-gray-600 font-medium">
                  {form.condition}
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
                <strong className="text-gray-700">{t("timerLabel")}:</strong>{" "}
                <span className="text-gray-600">
                  {form.startTime} → {form.endTime}
                </span>
              </div>
              <div>
                <strong className="text-gray-700">{t("itemImages")}:</strong>{" "}
                <span className="text-gray-600">
                  {form.images.filter(Boolean).length} {t("uploaded")}
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
