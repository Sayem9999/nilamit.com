"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Home, Search, Plus, Heart, User, Bell } from "lucide-react";
import { useNotifications } from "@/context/NotificationsContext";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Home;
  match: (path: string) => boolean;
  badge?: number;
  primary?: boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname() || "";
  const locale = useLocale();
  const t = useTranslations("Navigation");
  const { data: session } = useSession();
  const { unreadCount } = useNotifications();

  const stripped = pathname.replace(`/${locale}`, "") || "/";

  const items: NavItem[] = [
    { href: `/${locale}`,                  label: t("home") || "Home",     Icon: Home,   match: p => p === "/" },
    { href: `/${locale}/search`,           label: t("search") || "Search", Icon: Search, match: p => p.startsWith("/search") || p.startsWith("/auctions") },
    { href: `/${locale}/auctions/create`,  label: t("sell"),               Icon: Plus,   match: p => p.startsWith("/auctions/create"), primary: true },
    session
      ? { href: `/${locale}/dashboard?tab=watchlist`, label: t("watchlist") || "Saved", Icon: Heart, match: p => p.startsWith("/dashboard") }
      : { href: `/${locale}/login`,        label: t("signin"),             Icon: User,   match: p => p.startsWith("/login") },
    session
      ? { href: `/${locale}/profile`,      label: t("profile"),            Icon: Bell,   match: p => p.startsWith("/profile"), badge: unreadCount }
      : { href: `/${locale}/register`,     label: t("register") || "Join", Icon: User,   match: p => p.startsWith("/register") },
  ];

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-[0_-4px_20px_-12px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch justify-around h-16">
          {items.map((it) => {
            const active = it.match(stripped);
            const Icon = it.Icon;
            if (it.primary) {
              return (
                <li key={it.href} className="flex items-center justify-center -mt-6">
                  <Link
                    href={it.href}
                    aria-label={it.label}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 active:scale-95 transition-transform"
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.5} aria-hidden="true" />
                  </Link>
                </li>
              );
            }
            return (
              <li key={it.href} className="flex-1">
                <Link
                  href={it.href}
                  aria-label={(it.badge ?? 0) > 0 ? `${it.label} (${it.badge} unread)` : it.label}
                  aria-current={active ? "page" : undefined}
                  className={`relative h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                    active ? "text-primary-600" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span className="relative">
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                    {(it.badge ?? 0) > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
                      >
                        {it.badge! > 9 ? "9+" : it.badge}
                      </span>
                    )}
                  </span>
                  <span className="truncate max-w-full px-1">{it.label}</span>
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-b-full" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="md:hidden h-16" aria-hidden="true" />
    </>
  );
}
