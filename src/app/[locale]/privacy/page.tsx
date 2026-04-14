import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold text-gray-900 mb-4">
            {t("title")}
          </h1>
          <p className="text-gray-600">
            {t("subtitle")}
          </p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 space-y-10">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t("s1Title")}</h2>
            <p className="text-gray-600 leading-relaxed italic">{t("s1Desc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t("s2Title")}</h2>
            <p className="text-gray-600 leading-relaxed">{t("s2Desc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t("s3Title")}</h2>
            <p className="text-gray-600 leading-relaxed">{t("s3Desc")}</p>
          </section>
          
          <div className="pt-6 border-t border-gray-50 text-sm text-gray-400">
             Last updated: April 14, 2026
          </div>
        </div>
      </div>
    </div>
  );
}
