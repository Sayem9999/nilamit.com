import { getTranslations } from "next-intl/server";
import { ShieldCheck, Lock, Users, AlertTriangle } from "lucide-react";

export default async function SafetyPage() {
  const t = await getTranslations("Safety");

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-primary-100">
            <ShieldCheck className="w-3.5 h-3.5" /> {t("shield")}
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-6">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Financial Escrow</h3>
            <p className="text-gray-600 leading-relaxed">
              Every coordinated transaction is protected by our automated platform treasury. Funds are only settled after mutual confirmation or dispute resolution.
            </p>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Verified Identity</h3>
            <p className="text-gray-600 leading-relaxed">
              We use multi-step phone verification and MFS account linkage to ensure that every participant in the marketplace is a real person with accountability.
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 blur-[100px]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-2xl font-bold">{t("shield")} Policy</h3>
            </div>
            <p className="text-lg text-gray-300 leading-relaxed mb-0">
              {t("shieldDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
