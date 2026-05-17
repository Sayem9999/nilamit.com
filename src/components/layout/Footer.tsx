import Link from 'next/link';
import { Gavel, Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations("Footer");

  return (
    <footer className="bg-primary-900 text-white relative overflow-hidden">
      {/* Abstract Background Element */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-800 rounded-full blur-[100px] -mr-48 -mt-48 opacity-20" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center border border-white/5 shadow-inner shrink-0">
                <Gavel className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-black text-2xl tracking-tight">
                nilam<span className="text-primary-400">it</span>
              </span>
            </div>
            <p className="text-sm text-primary-200/80 leading-relaxed font-medium">
              {t("brandDesc")}
            </p>
            {/* App Check / reCAPTCHA Branding */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 border border-white/5 text-[10px] text-primary-300 font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3 text-blue-400" /> {t("secureMarketplace")}
              </div>
              <p className="text-[9px] text-primary-400/60 mt-2 leading-tight">
                Protected by reCAPTCHA Enterprise.<br />
                <a href="https://policies.google.com/privacy" className="hover:text-white transition-colors">Privacy</a> & <a href="https://policies.google.com/terms" className="hover:text-white transition-colors">Terms</a> apply.
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-primary-400 mb-6">{t("marketplace")}</h4>
            <ul className="space-y-3">
              <li><Link href="/auctions" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("browse")}</Link></li>
              <li><Link href="/auctions/create" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("sell")}</Link></li>
              <li><Link href="/leaderboard" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("leaderboard")}</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-primary-400 mb-6">{t("support")}</h4>
            <ul className="space-y-3">
              <li><Link href="/how-it-works" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("howItWorks")}</Link></li>
              <li><Link href="/safety" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("safety")}</Link></li>
              <li><Link href="/faq" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("faq")}</Link></li>
              <li><Link href="/contact" className="text-sm text-primary-200 hover:text-white transition-all hover:translate-x-1 inline-block">{t("contact")}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-primary-400 mb-6">{t("contactTitle")}</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-primary-200">
                <MapPin className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" /> 
                <span>Dhaka, Bangladesh</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-primary-200">
                <Phone className="w-4 h-4 text-primary-400 shrink-0" /> 
                <span>+880 1XX-XXXX-XXX</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-primary-200">
                <Mail className="w-4 h-4 text-primary-400 shrink-0" /> 
                <span>support@nilamit.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-2 md:items-start items-center">
            <p className="text-[10px] font-bold text-primary-400/60 uppercase tracking-widest">
              © {new Date().getFullYear()} nilamit.com — {t("allRights")}
            </p>
            <p className="text-[10px] font-bold text-primary-400/60 uppercase tracking-widest">
              Discover our other product: <a href="https://bdbusinessmarket.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary-300 transition-colors">bdbusinessmarket.com</a>
            </p>
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-[10px] font-bold text-primary-400/60 uppercase tracking-widest hover:text-white transition-colors">{t("privacy")}</Link>
            <Link href="/terms" className="text-[10px] font-bold text-primary-400/60 uppercase tracking-widest hover:text-white transition-colors">{t("terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
