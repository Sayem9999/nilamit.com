import { getTranslations } from "next-intl/server";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  MessagesSquare, 
  LifeBuoy 
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ContactPage() {
  const t = await getTranslations("Contact");

  return (
    <div className="pt-24 pb-20 min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto font-medium leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20 text-center">
          <div className="p-10 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Phone size={28} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{t("phoneLabel")}</h3>
            <p className="text-gray-900 font-bold mb-2">+880 1712 345 678</p>
            <p className="text-gray-500 text-sm font-medium">{t("availabilityNote")}</p>
          </div>

          <div className="p-10 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Mail size={28} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{t("email")}</h3>
            <p className="text-gray-900 font-bold mb-2">support@nilamit.com</p>
            <p className="text-gray-500 text-sm font-medium">{t("responseNote")}</p>
          </div>

          <div className="p-10 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MapPin size={28} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{t("location")}</h3>
            <p className="text-gray-900 font-bold mb-2">{t("address")}</p>
            <p className="text-gray-500 text-sm font-medium">{t("locationNote")}</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px]" />
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold mb-8">
              <ShieldCheck size={18} />
              <span>{t("supportNote")}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-8 leading-tight">
              {t("liveHelpTitle")}
            </h2>
            <p className="text-blue-100/70 text-lg font-medium leading-relaxed mb-10 max-w-2xl mx-auto">
              {t("liveHelpDesc")}
            </p>
            <Button size="lg" className="h-14 px-10 rounded-2xl bg-white text-gray-900 hover:bg-gray-100 font-bold text-lg">
              {t("openTicketBtn")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
