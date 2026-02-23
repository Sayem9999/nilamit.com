'use client';

import { useState } from 'react';
import { LayoutDashboard, ShieldAlert, Banknote, PenTool, Trash2, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'moderation' | 'finance' | 'content' | 'system';

interface AdminLayoutProps {
  overview: React.ReactNode;
  moderation?: React.ReactNode;
  finance?: React.ReactNode;
  content?: React.ReactNode;
  system: React.ReactNode;
}

export function AdminLayout({ overview, moderation, finance, content, system }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
    { id: 'finance', label: 'Finance', icon: Banknote },
    { id: 'content', label: 'Content', icon: PenTool },
    { id: 'system', label: 'System', icon: Trash2, danger: true },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Mobile Sidebar Toggle */}
      <button 
        className="lg:hidden fixed bottom-4 right-4 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-auto",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <h2 className="text-xl font-bold font-heading text-indigo-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            Admin Panel
          </h2>
          <p className="text-xs text-gray-500 mt-1">Command Center v2.0</p>
        </div>

        <nav className="px-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as Tab);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all",
                  activeTab === tab.id 
                    ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  tab.danger && activeTab === tab.id && "bg-red-50 text-red-700"
                )}
              >
                <Icon className={cn("w-5 h-5", tab.danger ? "text-red-500" : "text-gray-400", activeTab === tab.id && "text-current")} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && overview}
          {activeTab === 'moderation' && (moderation || <Placeholder tab="Moderation" />)}
          {activeTab === 'finance' && (finance || <Placeholder tab="Finance" />)}
          {activeTab === 'content' && (content || <Placeholder tab="Content" />)}
          {activeTab === 'system' && system}
        </div>
      </main>
    </div>
  );
}

function Placeholder({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <PenTool className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{tab} Coming Soon</h3>
      <p>This module is planned for Phase 11/12.</p>
    </div>
  );
}
