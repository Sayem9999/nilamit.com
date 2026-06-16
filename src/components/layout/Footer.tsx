import Link from 'next/link';
import { Gavel, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations("Footer");

  return (
    <footer className="bg-white border-t border-gray-200 text-gray-700 mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 text-sm">
          {/* Buy */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-3">{t("buy")}</h4>
            <ul className="space-y-2">
              <li><Link href="/auctions" className="text-gray-600 hover:text-primary-600 hover:underline">{t("browse")}</Link></li>
              <li><Link href="/auctions?sortBy=endTime&sortOrder=asc" className="text-gray-600 hover:text-primary-600 hover:underline">{t("endingSoon")}</Link></li>
              <li><Link href="/auctions?sortBy=bids&sortOrder=desc" className="text-gray-600 hover:text-primary-600 hover:underline">{t("trending")}</Link></li>
              <li><Link href="/auctions?featured=true" className="text-gray-600 hover:text-primary-600 hover:underline">{t("featured")}</Link></li>
            </ul>
          </div>

          {/* Sell */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-3">{t("sellHeading")}</h4>
            <ul className="space-y-2">
              <li><Link href="/auctions/create" className="text-gray-600 hover:text-primary-600 hover:underline">{t("sell")}</Link></li>
              <li><Link href="/dashboard?tab=listings" className="text-gray-600 hover:text-primary-600 hover:underline">{t("myListings")}</Link></li>
              <li><Link href="/dashboard/analytics" className="text-gray-600 hover:text-primary-600 hover:underline">Seller Analytics</Link></li>
              <li><Link href="/dashboard/saved-searches" className="text-gray-600 hover:text-primary-600 hover:underline">Saved Searches</Link></li>
              <li><Link href="/dashboard" className="text-gray-600 hover:text-primary-600 hover:underline">{t("dashboard")}</Link></li>
              <li><Link href="/leaderboard" className="text-gray-600 hover:text-primary-600 hover:underline">{t("leaderboard")}</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-3">{t("support")}</h4>
            <ul className="space-y-2">
              <li><Link href="/how-it-works" className="text-gray-600 hover:text-primary-600 hover:underline">{t("howItWorks")}</Link></li>
              <li><Link href="/safety" className="text-gray-600 hover:text-primary-600 hover:underline">{t("safety")}</Link></li>
              <li><Link href="/faq" className="text-gray-600 hover:text-primary-600 hover:underline">{t("faq")}</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-primary-600 hover:underline">{t("contact")}</Link></li>
              <li><Link href="/download" className="text-gray-600 hover:text-primary-600 hover:underline">Android App</Link></li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-3">{t("about")}</h4>
            <ul className="space-y-2">
              <li><Link href="/policy" className="text-gray-600 hover:text-primary-600 hover:underline">{t("policies")}</Link></li>
              <li><Link href="/privacy" className="text-gray-600 hover:text-primary-600 hover:underline">{t("privacy")}</Link></li>
              <li><Link href="/terms" className="text-gray-600 hover:text-primary-600 hover:underline">{t("terms")}</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-3">{t("contactTitle")}</h4>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                <span>Dhaka, Bangladesh</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <a href="mailto:support@nilamit.com" className="hover:text-primary-600 hover:underline">support@nilamit.com</a>
              </li>
            </ul>
          </div>

          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded flex items-center justify-center shrink-0">
                <Gavel className="w-4 h-4 text-white" />
              </div>
              <span className="font-heading font-bold text-lg text-gray-900 tracking-tight">
                nilam<span className="text-primary-600">it</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              {t("brandDesc")}
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold">
              <ShieldCheck className="w-3 h-3 text-blue-500" /> {t("secureMarketplace")}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs text-gray-500">
          <div>
            <p>© {new Date().getFullYear()} nilamit.com — {t("allRights")}</p>
            <p className="mt-1 text-[11px]">
              {t("alsoTry")}{" "}
              <a href="https://bdbusinessmarket.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-semibold">
                bdbusinessmarket.com
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-primary-600 hover:underline">{t("privacy")}</Link>
            <Link href="/terms" className="hover:text-primary-600 hover:underline">{t("terms")}</Link>
            <Link href="/contact" className="hover:text-primary-600 hover:underline">{t("contact")}</Link>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 mt-3">
          Protected by reCAPTCHA Enterprise.{" "}
          <a href="https://policies.google.com/privacy" className="hover:text-gray-600 hover:underline">Privacy</a>
          {" & "}
          <a href="https://policies.google.com/terms" className="hover:text-gray-600 hover:underline">Terms</a>
          {" apply."}
        </p>
      </div>
    </footer>
  );
}
