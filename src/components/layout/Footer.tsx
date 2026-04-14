import Link from 'next/link';
import { Gavel, Phone, Mail, MapPin } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

export function Footer() {
  const t = useTranslations("Footer");
  const locale = useLocale();

  return (
    <footer className="bg-primary-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Gavel className="w-4 h-4 text-primary-300" />
              </div>
              <span className="font-heading font-bold text-lg">
                nilam<span className="text-primary-300">it</span>
              </span>
            </div>
            <p className="text-sm text-primary-200 leading-relaxed">
              {t("brandDesc")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">{t("marketplace")}</h4>
            <ul className="space-y-2">
              <li><Link href={`/${locale}/auctions`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("browse")}</Link></li>
              <li><Link href={`/${locale}/auctions/create`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("sell")}</Link></li>
              <li><Link href={`/${locale}/leaderboard`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("leaderboard")}</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">{t("support")}</h4>
            <ul className="space-y-2">
              <li><Link href={`/${locale}/how-it-works`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("howItWorks")}</Link></li>
              <li><Link href={`/${locale}/safety`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("safety")}</Link></li>
              <li><Link href={`/${locale}/faq`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("faq")}</Link></li>
              <li><Link href={`/${locale}/contact`} className="text-sm text-primary-300 hover:text-white transition-colors">{t("contact")}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-4">{t("contactTitle")}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-primary-300">
                <MapPin className="w-4 h-4 flex-shrink-0" /> Dhaka, Bangladesh
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-300">
                <Phone className="w-4 h-4 flex-shrink-0" /> +880 1XX-XXXX-XXX
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-300">
                <Mail className="w-4 h-4 flex-shrink-0" /> support@nilamit.com
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-primary-400">
            © {new Date().getFullYear()} nilamit.com — {t("allRights")}
          </p>
          <div className="flex gap-4">
            <Link href={`/${locale}/privacy`} className="text-xs text-primary-400 hover:text-white transition-colors">{t("privacy")}</Link>
            <Link href={`/${locale}/terms`} className="text-xs text-primary-400 hover:text-white transition-colors">{t("terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
