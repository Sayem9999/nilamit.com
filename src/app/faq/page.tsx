import { getTranslations } from "next-intl/server";

export default async function FAQPage() {
  const t = await getTranslations("FAQ");

  const faqs = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
  ];

  return (
    <main className="min-h-screen bg-gray-50/50 pt-28 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold text-gray-900 mb-4">
            {t("title")}
          </h1>
          <p className="text-gray-600">{t("subtitle")}</p>
        </header>

        <ul className="space-y-6 list-none p-0">
          {faqs.map((faq, index) => (
            <li
              key={index}
              className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow motion-reduce:transition-none"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-3">{faq.q}</h2>
              <p className="text-gray-600 leading-relaxed">{faq.a}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
