"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useState } from "react";
import {
  Menu,
  X,
  Gavel,
  User,
  Plus,
  LayoutDashboard,
  Search,
  ShieldCheck,
  AlertTriangle,
  Trophy,
  ChevronDown,
  LogOut,
  Store,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/actions/auth";

export function Navbar() {
  const { data: session } = useSession();
  const t = useTranslations("Navigation");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut({ redirect: false });
      await logoutAction();
      window.location.href = "/login?signout=success";
    } catch (e) {
      console.error("SignOut flow failed", e);
      window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(`${window.location.origin}/login`)}`;
    }
  }, []);

  const isVerified = !!session?.user?.emailVerified;
  return (
    <nav className="sticky top-0 z-50 glass !bg-white/70 border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-gray-900">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-6">
            <form
              action="/auctions"
              className="w-full relative group"
            >
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="search"
                name="search"
                placeholder={t("searchPlaceholder")}
                className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-medium"
              />
            </form>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">

              <Link
                href="/auctions"
                className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
              >
                {t("browse")}
              </Link>

              {/* Explore Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors uppercase tracking-tight">
                  {t("explore")}{" "}
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                </button>
                <div className="absolute left-0 top-full pt-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 scale-95 group-hover:scale-100 origin-top-left">
                  <div className="w-56 bg-white border border-gray-100 rounded-2xl shadow-xl p-1.5 overflow-hidden">
                    <Link
                      href="/leaderboard"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <div className="font-bold">{t("leaderboard")}</div>
                        <div className="text-[10px] text-gray-400">
                          {t("leaderboardDesc")}
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
              {session?.user?.isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
                >
                  <Gavel className="w-4 h-4" /> {t("admin")}
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
                    href="/dashboard?tab=listings"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-1"
                  >
                    <Store className="w-4 h-4 text-blue-500" /> {t("myListings")}
                  </Link>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-1"
                  >
                    <LayoutDashboard className="w-4 h-4" /> {t("dashboard")}
                  </Link>
                  <div className="relative group">
                    <button className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-100/50 transition-all group">
                      <div className="relative">
                        {session.user?.image ? (
                          <Image
                            width={36}
                            height={36}
                            src={session.user.image}
                            alt=""
                            className="rounded-full ring-2 ring-white shadow-sm"
                          />
                        ) : (
                          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md ring-1 ring-black/5">
                          {session.user?.isVerifiedSeller ? (
                            <Trophy className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                          ) : isVerified ? (
                            <ShieldCheck className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                          ) : (
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <div className="hidden lg:flex flex-col items-start leading-tight">
                        <span className="text-xs font-black text-gray-900 uppercase tracking-tight">
                          {session.user?.name?.split(" ")[0]}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                          {t("profile")}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                    </button>
                    <div className="absolute right-0 top-full pt-2 w-56 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0 scale-95 group-hover:scale-100 origin-top-right z-50">
                      <div className="bg-white rounded-[1.5rem] shadow-2xl border border-gray-100 p-1.5 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-50 mb-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t("signedInAs")}</p>
                          <p className="text-xs font-bold text-gray-900 truncate">{session.user?.email}</p>
                        </div>
                      <Link
                        href="/profile"
                        className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <User className="w-4 h-4" /> {t("profile")}
                        </div>
                        {isVerified ? (
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {t("verified")}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {t("unverified")}
                          </span>
                        )}
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left rounded-xl transition-all font-bold"
                      >
                        <LogOut className="w-4 h-4" /> {t("signout")}
                      </button>
                    </div>
                  </div>
                </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black text-blue-600 uppercase tracking-widest animate-in fade-in slide-in-from-right duration-500">
                    <ShieldCheck className="w-3 h-3 fill-blue-500" /> Secure
                  </div>
                  <Link
                    href="/login"
                    className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    {t("signin")}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center gap-4 md:hidden">
              {/* Mobile Language Switcher Sidelined */}
              {/* 
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg"
              >
                {locale === "en" ? "🇧🇩" : "🇺🇸"}
              </button>
              */}
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
        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-gray-100 bg-white shadow-lg animate-in slide-in-from-top duration-300">
            <div className="px-4 py-4 space-y-2">
              <div className="pt-2 pb-1 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t("settings")}
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
                      href="/dashboard?tab=listings"
                      className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t("myListings")}
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
                      onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                      className="block w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
        ) : null}
    </nav>
  );
}
