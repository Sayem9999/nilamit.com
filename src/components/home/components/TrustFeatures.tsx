"use client";

import {
  Users,
  Gavel,
  CheckCircle,
  Phone,
  Clock,
  Shield,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function TrustFeatures() {
  const t = useTranslations("Home");

  const steps = [
    { icon: Users,       title: t("step1Title"), desc: t("step1Desc") },
    { icon: Gavel,       title: t("step2Title"), desc: t("step2Desc") },
    { icon: CheckCircle, title: t("step3Title"), desc: t("step3Desc") },
  ];

  const features = [
    { icon: ShieldCheck, title: t("trust1Title"), desc: t("trust1Desc") },
    { icon: Clock,       title: t("trust2Title"), desc: t("trust2Desc") },
    { icon: Shield,      title: t("trust3Title"), desc: t("trust3Desc") },
    { icon: TrendingUp,  title: t("trust4Title"), desc: t("trust4Desc") },
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
                <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4" aria-hidden="true">
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
                className="bg-primary-50/50 border border-primary-100 rounded-2xl p-6"
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
            {t("ctaFooterTitle")}
          </h2>
          <p className="text-primary-100 mb-8">{t("ctaFooterDesc")}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700"
          >
            {t("ctaFooterBtn")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
