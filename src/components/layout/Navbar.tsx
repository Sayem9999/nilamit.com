"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useState, useEffect } from "react";
import {
  Menu,
  X,
  Gavel,
  User,
  Plus,
  Search,
  ShieldCheck,
  AlertTriangle,
  Trophy,
  ChevronDown,
  LogOut,
  Bell,
  MessageSquare,
  Heart,
  Clock,
  Flame,
  Smartphone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/actions/auth";
import { getProxiedAvatarUrl } from "@/lib/avatar";
import { memo } from "react";
import { getClientDB, ensureFirebaseAuth } from "@/lib/firebase-client";
import { ref, onValue } from "firebase/database";
import { CATEGORIES } from "@/types";
import { LocaleSwitcher } from "./LocaleSwitcher";

export const Navbar = memo(function Navbar() {
  const { data: session } = useSession();
  const t = useTranslations("Navigation");
  const tCat = useTranslations("Categories");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const userId = session?.user?.id;
  const isVerified = !!session?.user?.emailVerified;

  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | null = null;
    let latest: Record<string, unknown> = {};
    const seenKey = `nilamit_notif_seen_${userId}`;

    // Unread = notifications stamped after the user last opened the inbox.
    // (Previously this counted every notification ever received, so the badge
    // never cleared and grew unbounded.)
    const recompute = () => {
      let seen = 0;
      try {
        seen = Number(localStorage.getItem(seenKey) || 0);
      } catch {
        seen = 0;
      }
      const entries = latest && typeof latest === "object" ? Object.values(latest) : [];
      const count = entries.filter((v) => {
        if (!v || typeof v !== "object") return false;
        const rec = v as Record<string, unknown>;
        const ts = Number(rec.timestamp ?? rec._ts ?? 0);
        return ts > seen;
      }).length;
      setUnreadCount(count);
    };

    const onSeen = () => recompute();
    window.addEventListener("nilamit:notif-seen", onSeen);

    void (async () => {
      try {
        await ensureFirebaseAuth();
        const db = getClientDB();
        const notifRef = ref(db, `notifications/user/${userId}`);
        unsub = onValue(
          notifRef,
          (snapshot) => {
            latest = (snapshot.val() as Record<string, unknown>) || {};
            recompute();
          },
          (error) => {
            console.error("Failed to subscribe to navbar notifications:", error);
            setUnreadCount(0);
          },
        );
      } catch (err) {
        console.error("Failed to subscribe to navbar notification count", err);
      }
    })();
    return () => {
      unsub?.();
      window.removeEventListener("nilamit:notif-seen", onSeen);
      setUnreadCount(0);
    };
  }, [userId]);

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

  // Featured categories shown in the persistent category strip (eBay style).
  // Subset of CATEGORIES — the rest live in the "All categories" search dropdown.
  const navCategorySlugs = [
    "mobile-phones",
    "computers-laptops",
    "electronics",
    "cameras-optics",
    "vehicles",
    "fashion",
    "watches-jewelry",
    "home-appliances",
    "home-garden",
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      {/* ── Utility row ── */}
      <div className="bg-gray-50 border-b border-gray-100 text-[12px]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
          <div className="flex items-center gap-3 text-gray-600 min-w-0">
            {session ? (
              <span className="truncate">
                {t("hi")}{" "}
                <Link
                  href={userId ? `/profile/${userId}` : "/dashboard?tab=profile"}
                  className="font-semibold text-gray-900 hover:text-primary-600 hover:underline"
                >
                  {session.user?.name?.split(" ")[0]}
                </Link>
                !
              </span>
            ) : (
              <span className="hidden sm:inline">
                {t("hi")}{" "}
                <Link href="/login" className="font-semibold text-primary-600 hover:underline">
                  {t("signin")}
                </Link>{" "}
                {t("or")}{" "}
                <Link href="/register" className="font-semibold text-primary-600 hover:underline">
                  {t("register")}
                </Link>
              </span>
            )}
          </div>
          <nav className="flex items-center gap-1 sm:gap-4 text-gray-600">
            <Link
              href="/dashboard?tab=watchlist"
              className="hidden sm:inline-flex items-center gap-1 hover:text-primary-600"
            >
              <Heart className="w-3.5 h-3.5" /> {t("watchlist")}
            </Link>
            <Link
              href="/auctions/create"
              className="inline-flex items-center gap-1 hover:text-primary-600 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> {t("sell")}
            </Link>
            {session && (
              <Link href="/dashboard" className="hidden sm:inline-flex hover:text-primary-600">
                {t("myAccount")}
              </Link>
            )}
            <Link href="/browse" className="hidden sm:inline-flex hover:text-primary-600">
              Browse
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-semibold"
            >
              <Smartphone className="w-3.5 h-3.5" /> Get the App
            </Link>
            <Link href="/how-it-works" className="hidden md:inline-flex hover:text-primary-600">
              {t("help")}
            </Link>
            {session?.user?.isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold"
              >
                <Gavel className="w-3.5 h-3.5" /> {t("admin")}
              </Link>
            )}
            <span className="h-3 w-px bg-gray-300 mx-1" />
            <LocaleSwitcher />
          </nav>
        </div>
      </div>

      {/* ── Main row: logo + dominant search + account icons ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 lg:gap-8 h-[68px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-md flex items-center justify-center shadow-sm">
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-2xl text-gray-900 tracking-tight hidden sm:inline">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>

          {/* Dominant search bar — takes the rest of the row */}
          <form
            action="/auctions"
            className="flex-1 flex items-stretch h-11 max-w-3xl overflow-hidden border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/25 transition-colors bg-white"
          >
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3" aria-hidden="true" />
              <input
                type="search"
                name="search"
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="w-full pl-10 pr-3 bg-transparent outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="hidden sm:flex items-center border-l border-gray-200">
              <select
                name="category"
                aria-label={t("scopeCategory")}
                className="h-full bg-transparent text-xs font-semibold text-gray-700 hover:text-gray-900 focus:outline-none px-3 cursor-pointer max-w-[170px] truncate"
              >
                <option value="">{t("allCategories")}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {tCat(cat.slug)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-5 sm:px-8 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold uppercase tracking-wide transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">{t("search")}</span>
            </button>
          </form>

          {/* Right cluster: prominent Sell CTA + chat + notifications + account */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {/* Big blue Sell CTA — always visible (signed in or out), since
                conversion to seller is the main marketplace funnel. */}
            <Link
              href="/auctions/create"
              className="inline-flex items-center gap-1.5 h-10 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-md shadow-sm hover:shadow-md transition-all active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t("sell")}</span>
            </Link>

            {session ? (
              <>
                <Link
                  href="/dashboard?tab=coordination"
                  title={t("chat")}
                  className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <MessageSquare className="w-5 h-5" />
                </Link>

                <Link
                  href="/dashboard?tab=notifications"
                  title={t("notifications")}
                  className="relative p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-white px-1">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Account dropdown */}
                <div className="relative group ml-1">
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      {session.user?.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getProxiedAvatarUrl(session.user.image) || ""}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center ring-1 ring-gray-200">
                          <User className="w-4 h-4 text-primary-600" />
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center ring-1 ring-gray-200">
                        {session.user?.isVerifiedSeller ? (
                          <Trophy className="w-2 h-2 text-amber-500 fill-amber-500" />
                        ) : isVerified ? (
                          <ShieldCheck className="w-2 h-2 text-blue-500 fill-blue-500" />
                        ) : (
                          <AlertTriangle className="w-2 h-2 text-amber-500" />
                        )}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <div className="absolute right-0 top-full pt-1 w-60 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                    <div className="bg-white rounded-md shadow-lg border border-gray-200 py-1">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                          {t("signedInAs")}
                        </p>
                        <p className="text-xs font-semibold text-gray-900 truncate">{session.user?.email}</p>
                      </div>
                      <Link
                        href={userId ? `/profile/${userId}` : "/dashboard?tab=profile"}
                        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4" /> {t("profile")}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isVerified ? "text-blue-700 bg-blue-50" : "text-amber-700 bg-amber-50"
                          }`}
                        >
                          {isVerified ? t("verified") : t("unverified")}
                        </span>
                      </Link>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="w-4 h-4" /> {t("dashboard")}
                      </Link>
                      <Link
                        href="/dashboard?tab=listings"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4" /> {t("myListings")}
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left border-t border-gray-100 mt-1"
                      >
                        <LogOut className="w-4 h-4" /> {t("signout")}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="ml-1 inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2 rounded-sm transition-colors"
              >
                {t("signin")}
              </Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md hover:bg-gray-50 shrink-0"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Category strip ── */}
      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            aria-label={t("categories")}
            className="flex items-center gap-1 h-10 overflow-x-auto scrollbar-none whitespace-nowrap text-[13px]"
          >
            <Link
              href="/auctions"
              className="px-3 py-1.5 font-semibold text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded transition-colors shrink-0"
            >
              {t("allCategories")}
            </Link>
            {navCategorySlugs.map((slug) => (
              <Link
                key={slug}
                href={`/auctions?category=${slug}`}
                className="px-3 py-1.5 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded transition-colors shrink-0"
              >
                {tCat(slug)}
              </Link>
            ))}
            <span className="h-4 w-px bg-gray-200 mx-1 shrink-0" />
            <Link
              href="/auctions?sortBy=endTime&sortOrder=asc"
              className="px-3 py-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors shrink-0 inline-flex items-center gap-1 font-semibold"
            >
              <Clock className="w-3.5 h-3.5" /> {t("endingSoon")}
            </Link>
            <Link
              href="/auctions?sortBy=bids&sortOrder=desc"
              className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0 inline-flex items-center gap-1 font-semibold"
            >
              <Flame className="w-3.5 h-3.5" /> {t("trending")}
            </Link>
            <Link
              href="/leaderboard"
              className="px-3 py-1.5 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded transition-colors shrink-0 inline-flex items-center gap-1"
            >
              <Trophy className="w-3.5 h-3.5" /> {t("leaderboard")}
            </Link>
          </nav>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen ? (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {session?.user && (
              <div className="px-3 py-3 bg-gray-50 rounded-md mb-3 flex items-center gap-3">
                <div className="relative shrink-0">
                  {session.user.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={getProxiedAvatarUrl(session.user.image) || ""}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover ring-1 ring-gray-200"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{session.user.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{session.user.email}</p>
                </div>
              </div>
            )}
            <Link
              href="/auctions"
              className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("browse")}
            </Link>
            <Link
              href="/auctions/create"
              className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("sell")}
            </Link>
            <Link
              href="/download"
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-primary-600 hover:bg-gray-50 rounded-md"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Smartphone className="w-4 h-4" /> Get the App
            </Link>
            {session ? (
              <>
                <Link
                  href="/dashboard?tab=watchlist"
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("watchlist")}
                </Link>
                <Link
                  href="/dashboard?tab=listings"
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("myListings")}
                </Link>
                <Link
                  href="/dashboard"
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("dashboard")}
                </Link>
                <Link
                  href="/dashboard?tab=notifications"
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{t("notifications")}</span>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white px-1">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard?tab=coordination"
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("chat")}
                </Link>
                <Link
                  href={userId ? `/profile/${userId}` : "/dashboard?tab=profile"}
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("profile")}
                </Link>
                {session.user?.isAdmin && (
                  <Link
                    href="/admin"
                    className="block px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("admin")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-md"
                >
                  {t("signout")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block px-3 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-md text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("signin")}
              </Link>
            )}
            <div className="pt-3 mt-3 border-t border-gray-100">
              <p className="px-3 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                {t("categories")}
              </p>
              {navCategorySlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/auctions?category=${slug}`}
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {tCat(slug)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
});

Navbar.displayName = "Navbar";
