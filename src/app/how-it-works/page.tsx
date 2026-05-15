import { getTranslations } from "next-intl/server";
import {
  Shield,
  CheckCircle,
  Mail,
  Zap,
  MessageSquare,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export default async function HowItWorksPage() {
  const t = await getTranslations("HowItWorks");

  const steps = [
    {
      title: t("step1Title"),
      desc: t("step1Desc"),
      icon: Mail,
      color: "bg-blue-600",
      shadow: "shadow-blue-200",
    },
    {
      title: t("step2Title"),
      desc: t("step2Desc"),
      icon: Zap,
      color: "bg-amber-500",
      shadow: "shadow-amber-200",
    },
    {
      title: t("step3Title"),
      desc: t("step3Desc"),
      icon: BadgeCheck,
      color: "bg-emerald-500",
      shadow: "shadow-emerald-200",
    },
    {
      title: t("step4Title"),
      desc: t("step4Desc"),
      icon: MessageSquare,
      color: "bg-indigo-600",
      shadow: "shadow-indigo-200",
    },
  ];

  return (
    <main className="pt-24 pb-20 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto font-medium leading-relaxed">
            {t("subtitle")}
          </p>
        </header>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24 list-none p-0">
          {steps.map((step, idx) => (
            <li
              key={idx}
              className="relative group p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div
                className={`w-14 h-14 ${step.color} ${step.shadow} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-lg`}
                aria-hidden="true"
              >
                <step.icon size={28} />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-3">{step.title}</h2>
              <p className="text-gray-500 text-sm leading-relaxed font-medium">{step.desc}</p>
              <div
                className="absolute top-8 right-8 text-4xl font-black text-gray-100/50 group-hover:text-gray-100 transition-colors motion-reduce:transition-none"
                aria-hidden="true"
              >
                0{idx + 1}
              </div>
            </li>
          ))}
        </ol>

        <section
          aria-labelledby="shield-heading"
          className="bg-gray-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden mb-24"
        >
          <div
            className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px]"
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                <Shield className="text-indigo-400 w-6 h-6" aria-hidden="true" />
                <span className="text-indigo-400 font-black uppercase tracking-[0.2em] text-xs">
                  {t("securityMeta")}
                </span>
              </div>
              <h2 id="shield-heading" className="text-3xl md:text-5xl font-black mb-6 leading-tight">
                {t("shieldTitle")}
              </h2>
              <p className="text-indigo-100/70 text-lg font-medium leading-relaxed mb-8">
                {t("shieldDesc")}
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0">
                {[t("feature1"), t("feature2"), t("feature3"), t("feature4")].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <CheckCircle className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="text-sm font-bold text-indigo-50">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="how-cta-heading" className="text-center">
          <h2 id="how-cta-heading" className="text-3xl font-black text-gray-900 mb-6">
            {t("ctaTitle")}
          </h2>
          <p className="text-gray-500 mb-10 max-w-xl mx-auto font-medium">
            {t("ctaDesc")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/search">
              <Button
                size="lg"
                className="h-14 px-10 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold text-lg pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
              >
                {t("browseBtn")}
              </Button>
            </Link>
            <Link href="/auctions/create">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 rounded-2xl border-2 border-gray-900 text-gray-900 font-bold text-lg hover:bg-gray-50 pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
              >
                {t("sellBtn")}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
