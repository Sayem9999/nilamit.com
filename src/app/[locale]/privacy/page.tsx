import { getTranslations } from "next-intl/server";
import { 
  ShieldCheck, 
  Eye, 
  Lock, 
  FileText 
} from "lucide-react";

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  const sections = [
    {
      title: t("s1Title"),
      desc: t("s1Desc"),
      icon: Eye,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: t("s2Title"),
      desc: t("s2Desc"),
      icon: Lock,
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      title: t("s3Title"),
      desc: t("s3Desc"),
      icon: ShieldCheck,
      color: "bg-indigo-50 text-indigo-600"
    }
  ];

  return (
    <div className="pt-24 pb-20 min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-bold mb-6">
            <FileText size={18} />
            <span>{t("lastUpdated")}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-500 font-medium leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="space-y-12 mb-20">
          {sections.map((section, idx) => (
            <div key={idx} className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-[2.5rem] bg-gray-50/50 border border-gray-100">
              <div className={`w-14 h-14 ${section.color} rounded-2xl flex items-center justify-center shrink-0`}>
                <section.icon size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{section.title}</h3>
                <p className="text-gray-500 font-medium leading-relaxed text-lg">
                  {section.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-100 rounded-[2.5rem] p-8 text-center">
          <p className="text-gray-500 font-bold text-sm">
            Nilamit coordinate system v1.8.0 | Verified Secure
          </p>
        </div>
      </div>
    </div>
  );
}
