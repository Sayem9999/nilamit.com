"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Upload,
  ShoppingBag,
  ShieldAlert,
  Settings,
  Sparkles
} from "lucide-react";

export function MerchantSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  const navItems = [
    {
      name: "Overview",
      href: "/retailer/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/retailer/dashboard",
    },
    {
      name: "Listings",
      href: "/dashboard?tab=listings",
      icon: Package,
      active: pathname === "/dashboard" && currentTab === "listings",
    },
    {
      name: "Bulk Sync",
      href: "/seller/inventory/bulk",
      icon: Upload,
      active: pathname === "/seller/inventory/bulk",
    },
    {
      name: "Orders Ledger",
      href: "/retailer/orders",
      icon: ShoppingBag,
      active: pathname === "/retailer/orders",
    },
    {
      name: "Dispute Center",
      href: "/retailer/disputes",
      icon: ShieldAlert,
      active: pathname === "/retailer/disputes",
    },
    {
      name: "Storefront Settings",
      href: "/retailer/settings",
      icon: Settings,
      active: pathname === "/retailer/settings",
    },
    {
      name: "Seller Perks",
      href: "/retailer/perks",
      icon: Sparkles,
      active: pathname === "/retailer/perks",
    },
  ];

  // Only render if we are currently inside a retailer or seller view, or on the buyer dashboard when showing listings tab
  const showSubNav =
    pathname.startsWith("/retailer") ||
    pathname.startsWith("/seller/inventory") ||
    (pathname === "/dashboard" && currentTab === "listings");

  if (!showSubNav) return null;

  return (
    <div className="w-full bg-white border-b border-slate-200 sticky top-16 z-20 shadow-sm/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8 overflow-x-auto no-scrollbar scroll-smooth py-1" aria-label="Seller Hub Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`inline-flex items-center gap-2 px-1 py-4 border-b-2 text-xs font-black uppercase tracking-widest transition-all focus-visible:outline-none whitespace-nowrap ${
                  item.active
                    ? "border-indigo-600 text-indigo-650"
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${item.active ? "text-indigo-650" : "text-slate-650"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
