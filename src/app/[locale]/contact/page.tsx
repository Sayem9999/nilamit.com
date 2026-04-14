import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone, MessageSquare } from "lucide-react";

export default async function ContactPage() {
  const t = await getTranslations("Contact");

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <h1 className="text-5xl font-heading font-bold text-gray-900 mb-6">
            {t("title")}
          </h1>
          <p className="text-xl text-gray-600">
            {t("subtitle")} We aim to respond to all inquiries within 2 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8">
              <Mail className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t("email")}</h3>
            <p className="text-gray-500 mb-6">Our team is available for technical support.</p>
            <a href="mailto:support@nilamit.com" className="text-lg font-bold text-indigo-600 hover:text-indigo-700">
              support@nilamit.com
            </a>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-8">
              <Phone className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Phone</h3>
            <p className="text-gray-500 mb-6">Available 9 AM - 11 PM Dhaka time.</p>
            <p className="text-lg font-bold text-emerald-600">
              +880 1XX-XXXX-XXX
            </p>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-8">
              <MapPin className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t("location")}</h3>
            <p className="text-gray-500 mb-6">Headquarters and Support Hub.</p>
            <p className="text-lg font-bold text-gray-900">
              Gulshan-1, Dhaka, Bangladesh
            </p>
          </div>
        </div>

        <div className="mt-16 bg-white rounded-[3rem] border border-gray-100 shadow-sm p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2">
            <h2 className="text-3xl font-heading font-bold text-gray-900 mb-6">Live Help Center</h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              For urgent disputes or bidding issues, our real-time moderation team can intervene directly in your Coordination Hub chats.
            </p>
            <button className="bg-primary-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary-500/20">
              <MessageSquare className="w-5 h-5" /> Open Support Ticket
            </button>
          </div>
          <div className="lg:w-1/2 w-full h-80 bg-gray-50 rounded-[2rem] border-4 border-white shadow-inner flex items-center justify-center text-gray-400 font-medium">
             [ Support Portal Map Integration ]
          </div>
        </div>
      </div>
    </div>
  );
}
