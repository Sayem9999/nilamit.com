"use client";

import {
  Gavel,
  ShieldCheck,
  ArrowRight,
  MapPin,
  Star,
  PlusCircle,
  DollarSign,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { SystemConfig } from "@/types";

interface TrustFeaturesProps {
  systemConfig?: SystemConfig;
}

export function TrustFeatures({ systemConfig }: TrustFeaturesProps) {
  const t = useTranslations("Home");
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const escrowRequired = systemConfig?.escrowRequired ?? true;

  const steps = [
    { icon: PlusCircle,  title: t("step1Title"), desc: t("step1Desc") },
    { icon: Gavel,       title: t("step2Title"), desc: t("step2Desc") },
    { 
      icon: Lock,        
      title: escrowRequired ? t("step3Title") : "Direct Negotiation & Handover", 
      desc: escrowRequired ? t("step3Desc") : "Coordinate local handovers (e.g. Dhanmondi, Gulshan) or home shipping via direct buyer-seller agreements." 
    },
  ];

  const features = [
    { icon: DollarSign,  title: t("trust1Title"), desc: t("trust1Desc") },
    { 
      icon: ShieldCheck, 
      title: escrowRequired ? t("trust2Title") : "Direct Handover Safeguards", 
      desc: escrowRequired ? t("trust2Desc") : "Filter items near your neighborhood so you can physically inspect them and pay cash on delivery." 
    },
    { icon: MapPin,      title: t("trust3Title"), desc: t("trust3Desc") },
    { icon: Star,        title: t("trust4Title"), desc: t("trust4Desc") },
  ];

  return (
    <>
      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-gray-50/50" aria-labelledby="how-it-works-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="how-it-works-heading" className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
              {t("howTitle")}
            </h2>
            <p className="mt-2 text-gray-500">{t("howSubtitle")}</p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-8 list-none p-0">
            {steps.map((step, i) => (
              <li key={i} className="text-center">
                <div className="w-14 h-14 bg-primary-100 rounded-md flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                  <step.icon className="w-7 h-7 text-primary-600" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 bg-primary-600 text-white rounded-full text-xs font-bold mb-3" aria-hidden="true">
                  {i + 1}
                </div>
                <h3 className="font-heading font-semibold text-gray-900 mb-2">
                  <span className="sr-only">Step {i + 1}: </span>{step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[250px] mx-auto">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="py-16 sm:py-20 bg-white" aria-labelledby="trust-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="trust-heading" className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
              {t("trustTitle")}
            </h2>
            <p className="mt-2 text-gray-500">{t("trustSubtitle")}</p>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none p-0">
            {features.map((feature, i) => (
              <li
                key={i}
                className="bg-primary-50/50 border border-primary-100 rounded-md p-6"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                  <feature.icon className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="font-heading font-semibold text-gray-900 mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-primary-600 to-primary-800" aria-labelledby="home-cta-heading">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 id="home-cta-heading" className="font-heading font-bold text-2xl sm:text-3xl text-white mb-4">
            {isAuthed ? t("ctaFooterTitleAuthed") : t("ctaFooterTitle")}
          </h2>
          <p className="text-primary-100 mb-8">
            {isAuthed ? t("ctaFooterDescAuthed") : t("ctaFooterDesc")}
          </p>
          <Link
            href={isAuthed ? "/auctions/create" : "/login"}
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700"
          >
            {isAuthed ? t("ctaFooterBtnAuthed") : t("ctaFooterBtn")}{" "}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
