import { getTranslations } from "next-intl/server";
import { Gavel, ShieldCheck, Truck, PackageCheck, Zap } from "lucide-react";

export default async function HowItWorksPage() {
  const t = await getTranslations("Navigation");

  const steps = [
    {
      title: t("step1Title"),
      desc: t("step1Desc"),
      icon: <Zap className="w-8 h-8 text-amber-500" />,
      color: "amber"
    },
    {
      title: t("step2Title"),
      desc: t("step2Desc"),
      icon: <Gavel className="w-8 h-8 text-primary-500" />,
      color: "primary"
    },
    {
      title: "Win & Verify",
      desc: "Winning triggers a secure payment gate. Link your bKash or Nagad to pay the official treasury instantly.",
      icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
      color: "emerald"
    },
    {
      title: "Sync & Ships",
      desc: "Once verified, the Coordination Hub unlocks real-time chat and delivery options. Both parties are now protected by the escrow hold.",
      icon: <Truck className="w-8 h-8 text-blue-500" />,
      color: "blue"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-heading font-bold text-gray-900 mb-6">
            Bidding, Built for Trust.
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            nilamit.com isn&apos;t just a marketplace—it&apos;s a verifiable coordinate system for Bangladeshi commerce. Here is how we protect your deals.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-0" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center group">
                <div className={`w-20 h-20 bg-white border-4 border-white shadow-xl rounded-[2rem] flex items-center justify-center mb-8 relative z-10 transition-transform group-hover:-translate-y-2`}>
                   {step.icon}
                   <div className="absolute -top-3 -right-3 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold border-4 border-white">
                     {index + 1}
                   </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm text-center flex-1 w-full hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="bg-primary-900 rounded-[3rem] p-12 text-white shadow-2xl overflow-hidden relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl" />
            <h2 className="text-3xl font-heading font-bold mb-8">Ready to start?</h2>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed">
              Join thousands of verified traders. Whether you are selling tech gear or buying a collection piece, nilamit ensures the transaction is zero-technicality and full-transparency.
            </p>
            <div className="flex gap-4">
               <button className="bg-white text-primary-900 px-8 py-4 rounded-2xl font-bold hover:bg-primary-50 transition-all shadow-xl shadow-black/10">Browse Auctions</button>
               <button className="bg-primary-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-primary-700 transition-all border border-primary-700/50">Sell an Item</button>
            </div>
          </div>
          
          <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <PackageCheck className="w-8 h-8 text-primary-600" />
                <h3 className="text-2xl font-bold text-gray-900">Guarantee Shield</h3>
             </div>
             <p className="text-gray-600 leading-relaxed text-lg mb-8">
               Our anti-sniping protection ensures no one &quot;steals&quot; a deal in the last fraction of a second. Every participant gets a fair chance to place their final bid.
             </p>
             <ul className="space-y-4">
                {[
                  "Verified bKash/Nagad Identities",
                  "Automated Platform Escrow",
                  "2-Minute Extension (Soft Close)",
                  "Real-time Coordination Hub"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                    <div className="w-2 h-2 bg-primary-500 rounded-full" /> {item}
                  </li>
                ))}
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
