"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  ShieldAlert,
  Banknote,
  PenTool,
  Trash2,
  Menu,
  X,
  Users,
  Scale,
  ShieldCheck,
  TrendingUp,
  Wrench,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab =
  | "overview"
  | "moderation"
  | "metrics"
  | "content"
  | "system"
  | "users"
  | "treasury"
  | "disputes"
  | "kyc"
  | "operations"
  | "featureFlags"
  | "audit"
  | "live";

const TAB_IDS: Tab[] = [
  "overview",
  "live",
  "operations",
  "featureFlags",
  "moderation",
  "users",
  "kyc",
  "metrics",
  "content",
  "treasury",
  "disputes",
  "audit",
  "system",
];

function isTab(value: string): value is Tab {
  return (TAB_IDS as string[]).includes(value);
}

interface AdminLayoutProps {
  overview: React.ReactNode;
  moderation?: React.ReactNode;
  metrics?: React.ReactNode;
  content?: React.ReactNode;
  system: React.ReactNode;
  users?: React.ReactNode;
  treasury?: React.ReactNode;
  disputes?: React.ReactNode;
  kyc?: React.ReactNode;
  operations?: React.ReactNode;
  featureFlags?: React.ReactNode;
  audit?: React.ReactNode;
  live?: React.ReactNode;
}

export function AdminLayout({
  overview,
  moderation,
  metrics,
  content,
  system,
  users,
  treasury,
  disputes,
  kyc,
  operations,
  featureFlags,
  audit,
  live,
}: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Deep-link the active tab to the URL hash (#users) so a refresh, a shared
  // link, and the browser back button all land on the right tab instead of
  // silently resetting to Overview.
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && isTab(hash)) setActiveTab(hash);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const selectTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
    if (window.location.hash !== `#${tab}`) {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }, []);

  // Close the mobile drawer on Escape for keyboard users.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSidebarOpen]);

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "live", label: "Live Activity", icon: TrendingUp },
    { id: "operations", label: "Operations", icon: Wrench, danger: true },
    { id: "featureFlags", label: "Feature Flags", icon: SlidersHorizontal },
    { id: "moderation", label: "Moderation", icon: ShieldAlert },
    { id: "users", label: "Users", icon: Users },
    { id: "kyc", label: "KYC Queue", icon: ShieldCheck },
    { id: "metrics", label: "Metrics", icon: Banknote },
    { id: "content", label: "Content", icon: PenTool },
    { id: "treasury", label: "Treasury", icon: ShieldCheck },
    { id: "disputes", label: "Disputes", icon: Scale },
    { id: "audit", label: "Audit Log", icon: FileText },
    { id: "system", label: "System", icon: Trash2, danger: true },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Mobile Sidebar Toggle */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        onClick={() => setIsSidebarOpen((open) => !open)}
        aria-label={isSidebarOpen ? "Close admin menu" : "Open admin menu"}
        aria-expanded={isSidebarOpen}
        aria-controls="admin-sidebar"
      >
        {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile backdrop — tap-to-dismiss the drawer */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-[1px]"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-auto",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold font-heading text-indigo-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            Marketplace Control Board
          </h2>
          <p className="text-xs text-gray-500 mt-1">Nilamit C2C Management Console</p>
        </div>

        <nav className="px-4 space-y-1" aria-label="Admin sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id as Tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  tab.danger && isActive && "bg-red-50 text-red-700",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    tab.danger ? "text-red-500" : "text-gray-400",
                    isActive && "text-current",
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {activeTab === "overview" && overview}
          {activeTab === "live" && live}
          {activeTab === "moderation" && moderation}
          {activeTab === "metrics" && metrics}
          {activeTab === "content" && content}
          {activeTab === "users" && users}
          {activeTab === "treasury" && treasury}
          {activeTab === "disputes" && disputes}
          {activeTab === "kyc" && kyc}
          {activeTab === "operations" && operations}
          {activeTab === "featureFlags" && featureFlags}
          {activeTab === "audit" && audit}
          {activeTab === "system" && system}
        </div>
      </main>
    </div>
  );
}
