import StarMapVisualization from "@/components/StarMap";
import { getTrustGraphData } from "@/actions/social";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function StarMapPage() {
  const data = await getTrustGraphData();
  const t = await getTranslations("TrustMap");

  return (
    <main className="w-screen h-screen m-0 p-0 overflow-hidden bg-slate-950 relative">
      {/* Localized Overlay */}
      <div className="absolute top-8 left-8 z-50 max-w-sm pointer-events-none">
         <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto">
            <Link 
              href="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 mb-4 transition-colors group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </Link>
            <h1 className="text-2xl font-heading font-bold text-white mb-2 leading-tight">
              {t("title")}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {t("subtitle")}
            </p>
            <div className="mt-6 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
               <div className="flex items-center gap-1.5 text-indigo-400">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /> Sale
               </div>
               <div className="flex items-center gap-1.5 text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-slate-700" /> Interest
               </div>
            </div>
         </div>
      </div>

      <StarMapVisualization initialData={data} />
    </main>
  );
}
