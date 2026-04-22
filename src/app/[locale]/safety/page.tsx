import { getTranslations } from "next-intl/server";
import { 
  ShieldCheck, 
  Lock, 
  AlertCircle,
  UserCheck,
  MessageSquare,
  Gavel
} from "lucide-react";

export default async function SafetyPage() {
  const t = await getTranslations("Safety");

  const highlights = [
    {
      title: t("escrowTitle"),
      desc: t("escrowDesc"),
      icon: Lock,
      color: "bg-amber-100 text-amber-600"
    },
    {
      title: t("identityTitle"),
      desc: t("identityDesc"),
      icon: UserCheck,
      color: "bg-blue-100 text-blue-600"
    },
    {
      title: t("coordTitle"),
      desc: t("coordDesc"),
      icon: MessageSquare,
      color: "bg-emerald-100 text-emerald-600"
    },
    {
      title: t("disputeTitle"),
      desc: t("disputeDesc"),
      icon: Gavel,
      color: "bg-purple-100 text-purple-600"
    }
  ];

  return (
    <div className="pt-24 pb-20 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-bold mb-6">
            <ShieldCheck size={18} />
            <span>{t("subNote")}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto font-medium leading-relaxed">
            {t("heroDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {highlights.map((item, idx) => (
            <div key={idx} className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center mb-6`}>
                <item.icon size={24} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-500 font-medium leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 rounded-[3rem] p-12 border border-amber-100 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-amber-200 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle size={32} className="text-amber-700" />
            </div>
            <div className="flex-grow">
              <h2 className="text-2xl font-black text-amber-900 mb-2">{t("warningTitle")}</h2>
              <p className="text-amber-800 font-medium leading-relaxed">
                {t("warningDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
