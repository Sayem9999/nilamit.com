'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { Menu, X, Gavel, User, LogOut, Plus, LayoutDashboard, Globe, Zap, ZapOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/context/SettingsContext';

export function Navbar() {
  const { data: session } = useSession();
  const { locale, setLocale, t } = useLanguage();
  const { lightweightMode, toggleLightweightMode } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'bn' : 'en');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
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

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors bg-gray-50 px-3 py-1.5 rounded-lg"
              title={locale === 'en' ? 'Switch to Bangla' : 'English এ পরিবর্তন করুন'}
            >
              <Globe className="w-4 h-4" />
              {locale === 'en' ? 'বাংলা' : 'English'}
            </button>

            <button
              onClick={toggleLightweightMode}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg ${
                lightweightMode 
                  ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                  : 'bg-gray-50 text-gray-600 hover:text-primary-600'
              }`}
              title={lightweightMode ? 'Standard Mode (Show Images)' : 'Lightweight Mode (Save Data)'}
            >
              {lightweightMode ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              {lightweightMode ? 'Standard' : 'Lite'}
            </button>

            <Link href="/auctions" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              {t.nav.browse}
            </Link>
            {(session?.user as any)?.isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors flex items-center gap-1">
                <Gavel className="w-4 h-4" /> Admin
              </Link>
            )}
            {session ? (
              <>
                <Link href="/auctions/create" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-1">
                  <Plus className="w-4 h-4" /> {t.nav.sell}
                </Link>
                <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-1">
                  <LayoutDashboard className="w-4 h-4" /> {t.nav.dashboard}
                </Link>
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    {session.user?.image ? (
                      <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-600" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">{session.user?.name?.split(' ')[0]}</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <User className="w-4 h-4" /> {t.nav.profile}
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" /> {t.nav.signout}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                {t.nav.signin}
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-4 md:hidden">
             <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg"
            >
              {locale === 'en' ? '🇧🇩' : '🇺🇸'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl hover:bg-gray-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-4 space-y-2">
            <Link href="/auctions" className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl" onClick={() => setMobileMenuOpen(false)}>
              {t.nav.browse}
            </Link>
            {session ? (
              <>
                <Link href="/auctions/create" className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl" onClick={() => setMobileMenuOpen(false)}>
                  {t.nav.sell}
                </Link>
                <Link href="/dashboard" className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl" onClick={() => setMobileMenuOpen(false)}>
                  {t.nav.dashboard}
                </Link>
                <Link href="/profile" className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl" onClick={() => setMobileMenuOpen(false)}>
                  {t.nav.profile}
                </Link>
                <button
                  onClick={() => { signOut(); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl"
                >
                   {t.nav.signout}
                </button>
              </>
            ) : (
              <Link href="/login" className="block px-4 py-3 text-sm font-semibold text-primary-600 bg-primary-50 rounded-xl text-center" onClick={() => setMobileMenuOpen(false)}>
                 {t.nav.signin}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
