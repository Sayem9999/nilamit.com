import { getTranslations } from "next-intl/server";
import {
  Gavel,
  Handshake,
  Ban,
  Scale,
} from "lucide-react";

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  const sections = [
    {
      title: t("s1Title"),
      desc: t("s1Desc"),
      icon: Handshake,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: t("s2Title"),
      desc: t("s2Desc"),
      icon: Ban,
      color: "bg-red-50 text-red-600",
    },
    {
      title: t("s3Title"),
      desc: t("s3Desc"),
      icon: Scale,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <main className="pt-28 pb-20 min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-600 text-sm font-bold mb-6">
            <Gavel size={18} aria-hidden="true" />
            <span>{t("compliance")}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-500 font-medium leading-relaxed">
            {t("subtitle")}
          </p>
        </header>

        <ul className="space-y-12 mb-20 list-none p-0">
          {sections.map((section, idx) => (
            <li
              key={idx}
              className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-[2.5rem] bg-gray-50/50 border border-gray-100"
            >
              <div
                className={`w-14 h-14 ${section.color} rounded-md flex items-center justify-center shrink-0`}
                aria-hidden="true"
              >
                <section.icon size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                <p className="text-gray-500 font-medium leading-relaxed text-lg">
                  {section.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <aside className="bg-gray-100 rounded-[2.5rem] p-8 text-center">
          <p className="text-gray-500 font-bold text-sm">
            Nilamit Governance System v1.8.0 | PSSA 2024 Compliant
          </p>
        </aside>
      </div>
    </main>
  );
}
