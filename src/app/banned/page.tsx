import { getTranslations } from "next-intl/server";
import { Ban, Mail, Home } from "lucide-react";
import Link from "next/link";

export default async function BannedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("Banned");

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-md border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-red-600 p-8 flex justify-center">
          <div className="bg-white/20 p-4 rounded-full backdrop-blur-md">
            <Ban className="w-16 h-16 text-white" />
          </div>
        </div>

        <div className="p-8 md:p-12 text-center">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            {t("description")}
          </p>
          <p className="text-sm text-gray-400 italic mb-8">
            {t("subtext")}
          </p>

          <div className="bg-gray-50 rounded-md p-6 text-left mb-8 border border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-red-500 rounded-full" />
              {t("reasonTitle")}
            </h2>
            <ul className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className="flex items-start gap-3 text-gray-600 text-sm">
                  <div className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">
                    {i}
                  </div>
                  {t(`reason${i}` as "reason1" | "reason2" | "reason3" | "reason4")}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-gray-500 mb-8 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            {t("contactSupport")}
          </p>

          <Link
            href={`/`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-md font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
          >
            <Home className="w-5 h-5" />
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
