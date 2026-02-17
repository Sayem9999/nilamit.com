"use client";

import {
  Users,
  Gavel,
  CheckCircle,
  Phone,
  Clock,
  Shield,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

import { TranslationType } from "@/types/home";

interface TrustFeaturesProps {
  t: TranslationType;
}

export function TrustFeatures({ t }: TrustFeaturesProps) {
  return (
    <>
      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
              {t.home.how_title}
            </h2>
            <p className="mt-2 text-gray-500">{t.home.how_subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: t.home.step_1_title,
                desc: t.home.step_1_desc,
              },
              {
                icon: Gavel,
                title: t.home.step_2_title,
                desc: t.home.step_2_desc,
              },
              {
                icon: CheckCircle,
                title: t.home.step_3_title,
                desc: t.home.step_3_desc,
              },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-7 h-7 text-primary-600" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 bg-primary-600 text-white rounded-full text-xs font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="font-heading font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[250px] mx-auto">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
              {t.home.trust_title}
            </h2>
            <p className="mt-2 text-gray-500">{t.home.trust_subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Phone,
                title: t.home.trust_1_title,
                desc: t.home.trust_1_desc,
              },
              {
                icon: Clock,
                title: t.home.trust_2_title,
                desc: t.home.trust_2_desc,
              },
              {
                icon: Shield,
                title: t.home.trust_3_title,
                desc: t.home.trust_3_desc,
              },
              {
                icon: TrendingUp,
                title: t.home.trust_4_title,
                desc: t.home.trust_4_desc,
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-primary-50/50 border border-primary-100 rounded-2xl p-6"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="font-heading font-semibold text-gray-900 mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-primary-600 to-primary-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-white mb-4">
            {t.home.cta_footer_title}
          </h2>
          <p className="text-primary-100 mb-8">{t.home.cta_footer_desc}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-all shadow-lg"
          >
            {t.home.cta_footer_btn} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
