"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  Menu,
  X,
  Gavel,
  User,
  LogOut,
  Plus,
  LayoutDashboard,
  Globe,
  Search,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { requestNotificationPermission } from "@/lib/notifications";
import { useSettings } from "@/context/SettingsContext";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

export function Navbar() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("Navigation");
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  const toggleLanguage = () => {
    const newLocale = locale === "en" ? "bn" : "en";
    // Remove the current locale prefix to switch
    const currentPath = pathname.replace(`/${locale}`, "") || "/";
    router.push(`/${newLocale}${currentPath}`);
  };

  return (
    <nav className="sticky top-0 z-50 glass !bg-white/70 border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-gray-900">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <form
              action={`/${locale}/search`}
              className="w-full relative group"
            >
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="search"
                name="q"
                placeholder="Search auctions..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-medium"
              />
            </form>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-gray-50 border border-gray-100 hover:bg-white hover:border-primary-200 transition-all px-4 py-2 rounded-xl shadow-sm"
              title={
                locale === "en" ? "বাংলা" : "English"
              }
            >
              <Globe className="w-4 h-4 text-primary-500" />
              <span>{locale === "en" ? "বাংলা" : "English"}</span>
            </button>





            <Link
              href="/auctions"
              className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
            >
              {t("browse")}
            </Link>
            {(session?.user as { isAdmin?: boolean })?.isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
              >
                <Gavel className="w-4 h-4" /> Admin
              </Link>
            )}
            {session ? (
              <>
                <Link
                  href="/auctions/create"
                  className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> {t("sell")}
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-1"
                >
                  <LayoutDashboard className="w-4 h-4" /> {t("dashboard")}
                </Link>
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    {session.user?.image ? (
                      <Image
                        width={32}
                        height={32}
                        src={session.user.image}
                        alt=""
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-600" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      {session.user?.name?.split(" ")[0]}
                      {(session?.user as { isPhoneVerified?: boolean; emailVerified?: boolean })?.isPhoneVerified || (session?.user as { isPhoneVerified?: boolean; emailVerified?: boolean })?.emailVerified ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <Link
                      href="/profile"
                      className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" /> {t("profile")}
                      </div>
                      {(session?.user as { isPhoneVerified?: boolean; emailVerified?: boolean })?.isPhoneVerified || (session?.user as { isPhoneVerified?: boolean; emailVerified?: boolean })?.emailVerified ? (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase">Verified</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md uppercase">Unverified</span>
                      )}
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" /> {t("signout")}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                {t("signin")}
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-4 md:hidden">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg"
            >
              {locale === "en" ? "🇧🇩" : "🇺🇸"}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl hover:bg-gray-50"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg animate-in slide-in-from-top duration-300">
          <div className="px-4 py-4 space-y-2">
            <div className="pt-2 pb-1 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t("settings")}
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 py-2">
              <button
                onClick={toggleLanguage}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-xl"
              >
                <Globe className="w-4 h-4" />
                {locale === "en" ? "বাংলা" : "English"}
              </button>

            </div>
            <div className="border-t border-gray-50 mt-2 pt-2">
              <Link
                href="/auctions"
                className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("browse")}
              </Link>
              {session ? (
                <>
                  <Link
                    href="/auctions/create"
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("sell")}
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("dashboard")}
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("profile")}
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    {t("signout")}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="block px-4 py-3 text-sm font-semibold text-primary-600 bg-primary-50 rounded-xl text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("signin")}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
