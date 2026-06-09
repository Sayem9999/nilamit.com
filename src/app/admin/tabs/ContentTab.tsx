'use client';

import { useState } from 'react';
import { updateSystemConfig, toggleFeaturedAuction } from '@/actions/admin-content';
import { 
  Loader2, 
  Trash2, 
  Save, 
  Image as ImageIcon, 
  Search, 
  Copy, 
  Check, 
  Star, 
  Plus, 
  ExternalLink 
} from 'lucide-react';
import { ImageUpload } from '@/components/upload/ImageUpload';
import Image from 'next/image';
import { SystemConfig, AuctionWithSeller } from '@/types';
import toast from 'react-hot-toast';

/** BD MFS (bKash/Nagad) wallet number: 11 digits, 01[3-9]XXXXXXXX. Mirrors the
 *  server check in systemConfigUpdateSchema so admins get instant feedback. */
const MFS_NUMBER_RE = /^01[3-9]\d{8}$/;

interface ContentTabProps {
  initialConfig: SystemConfig;
  featuredAuctions: { id: string; title: string; currentPrice: number; images: string[] }[];
  /** Active auctions for the "feature this" directory — fetched server-side in
   *  admin/page.tsx and passed in, so this tab never client-fetches (avoids the
   *  fragile Server-Action-on-mount pattern). */
  activeAuctions: AuctionWithSeller[];
}

export function ContentTab({ initialConfig, featuredAuctions, activeAuctions }: ContentTabProps) {
  const [config, setConfig] = useState(initialConfig);
  const [auctions, setAuctions] = useState(featuredAuctions);
  const [isSaving, setIsSaving] = useState(false);
  const [newAuctionId, setNewAuctionId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Each save button writes only its own fields (updateSystemConfig merges),
  // so saving the banner no longer rewrites treasury numbers and vice-versa.
  const saveFields = async (fields: Parameters<typeof updateSystemConfig>[0], label: string) => {
    setIsSaving(true);
    try {
      const res = await updateSystemConfig(fields);
      if (res.success) {
        toast.success(`${label} updated successfully!`);
      } else {
        toast.error(res.error?.message || `Failed to update ${label.toLowerCase()}`);
      }
    } catch (e: unknown) {
      toast.error(`Failed to update ${label.toLowerCase()}: ` + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBanner = () => saveFields({
    heroTitle: config.heroTitle ?? undefined,
    heroSubtitle: config.heroSubtitle ?? undefined,
    heroImage: config.heroImage ?? undefined,
  }, 'Homepage banner');

  const handleSaveTreasury = () => {
    const bkash = (config.treasuryBkash ?? '').trim();
    const nagad = (config.treasuryNagad ?? '').trim();
    // These numbers are the live payment destinations shown to buyers at
    // checkout — reject a malformed entry before it can misroute money.
    if (bkash && !MFS_NUMBER_RE.test(bkash)) {
      toast.error('bKash number must be 11 digits, e.g. 01712345678');
      return;
    }
    if (nagad && !MFS_NUMBER_RE.test(nagad)) {
      toast.error('Nagad number must be 11 digits, e.g. 01712345678');
      return;
    }
    saveFields({ treasuryBkash: bkash, treasuryNagad: nagad }, 'Treasury');
  };

  const handleToggleFeatured = async (id: string) => {
    if (!id.trim()) {
      toast.error('Please enter or select a valid Auction ID');
      return;
    }

    try {
      const isCurrentlyFeatured = auctions.some(a => a.id === id);
      if (isCurrentlyFeatured && !window.confirm('Remove this auction from the featured list?')) {
        return;
      }
      const res = await toggleFeaturedAuction(id, !isCurrentlyFeatured);
      
      if (res.success) {
        if (!isCurrentlyFeatured) {
          // Find details from local activeAuctions state to update UI reactively
          const activeDetails = activeAuctions.find(a => a.id === id);
          if (activeDetails) {
            setAuctions(prev => [
              ...prev,
              {
                id: activeDetails.id,
                title: activeDetails.title,
                currentPrice: activeDetails.currentPrice,
                images: activeDetails.images ?? [],
              }
            ]);
            setNewAuctionId('');
            toast.success('Auction featured successfully!');
          } else {
            // Fallback to reload if not found in cache
            toast.success('Auction featured! Reloading...');
            setTimeout(() => window.location.reload(), 800);
          }
        } else {
          setAuctions(prev => prev.filter(a => a.id !== id));
          toast.success('Auction removed from featured list');
        }
      } else {
        toast.error(res.error?.message || 'Failed to toggle featured status');
      }
    } catch (e: unknown) {
      toast.error('Error: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Auction ID copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter active auctions based on search term
  const filteredActiveAuctions = activeAuctions.filter(auction => 
    auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auction.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* 1. Hero Section Manager */}
      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-indigo-600" />
          Homepage Banner
        </h3>
        <div className="space-y-4 max-w-2xl">
          <div>
            <label htmlFor="cfg-hero-title" className="text-sm font-medium text-gray-700">Hero Title</label>
            <input
              id="cfg-hero-title"
              type="text"
              value={config.heroTitle || ''}
              onChange={e => setConfig({ ...config, heroTitle: e.target.value })}
              className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div>
            <label htmlFor="cfg-hero-subtitle" className="text-sm font-medium text-gray-700">Hero Subtitle</label>
            <input
              id="cfg-hero-subtitle"
              type="text"
              value={config.heroSubtitle || ''}
              onChange={e => setConfig({ ...config, heroSubtitle: e.target.value })}
              className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Banner Image</label>
            <div className="mt-2">
              <ImageUpload 
                value={config.heroImage ? [config.heroImage] : []}
                onChange={(urls) => setConfig({ ...config, heroImage: urls[0] || null })}
                onRemove={() => setConfig({ ...config, heroImage: null })}
              />
            </div>
          </div>
          <button
            onClick={handleSaveBanner}
            disabled={isSaving}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* 1.5 Treasury Configuration */}
      <div className="bg-white rounded-md border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="font-heading font-semibold text-lg text-emerald-900 mb-4 flex items-center gap-2">
          <Save className="w-5 h-5 text-emerald-600" />
          Official Treasury Accounts
        </h3>
        <p className="text-sm text-gray-500 mb-6">These numbers will be displayed in the Automated Checkout Gateway.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label htmlFor="cfg-treasury-bkash" className="text-xs font-bold text-gray-400 uppercase tracking-wide">bKash Merchant/Personal</label>
            <input
              id="cfg-treasury-bkash"
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={config.treasuryBkash || ''}
              onChange={e => setConfig({ ...config, treasuryBkash: e.target.value.replace(/\D/g, '') })}
              placeholder="017XXXXXXXX"
              className="w-full mt-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono transition-all"
            />
          </div>
          <div>
            <label htmlFor="cfg-treasury-nagad" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Nagad Merchant/Personal</label>
            <input
              id="cfg-treasury-nagad"
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={config.treasuryNagad || ''}
              onChange={e => setConfig({ ...config, treasuryNagad: e.target.value.replace(/\D/g, '') })}
              placeholder="018XXXXXXXX"
              className="w-full mt-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono transition-all"
            />
          </div>
        </div>
        <div className="mt-6">
          <button 
            onClick={handleSaveTreasury}
            disabled={isSaving}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sync Treasury
          </button>
        </div>
      </div>

      {/* 2. Featured Auctions */}
      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
          Featured Auctions
        </h3>
        <p className="text-sm text-gray-500 mb-6">Hydrate your landing page with premium listings selected to hook buyer interest.</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Side: Featured Listings & Manual Add */}
          <div className="space-y-6">
            <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wider">Currently Featured</h4>
            
            {/* List of Featured */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
              {auctions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-md border border-dashed border-gray-200 text-center">
                  <Star className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No auctions featured yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Select from the directory or paste an ID below.</p>
                </div>
              ) : (
                auctions.map((auction) => (
                  <div key={auction.id} className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-50 rounded-md border border-gray-100 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 relative rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        {auction.images?.[0] ? (
                          <Image src={auction.images[0]} alt={auction.title} fill sizes="48px" className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate group-hover:text-amber-600 transition-colors">{auction.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-primary-600">৳{auction.currentPrice.toLocaleString()}</span>
                          <span className="text-gray-300 text-[10px]">•</span>
                          <span className="text-[10px] font-mono text-gray-400 truncate max-w-[120px]">{auction.id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleCopyId(auction.id)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Copy Auction ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleToggleFeatured(auction.id)}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-xl transition-all"
                        title="Remove from Featured"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Manual Add Input */}
            <div className="pt-4 border-t border-gray-100">
              <h5 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2.5">Advanced: Add by Custom ID</h5>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter or paste Auction ID" 
                  value={newAuctionId}
                  onChange={e => setNewAuctionId(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                />
                <button 
                  onClick={() => handleToggleFeatured(newAuctionId)}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-black active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Active Listings Directory */}
          <div className="bg-gray-50/40 rounded-md border border-gray-100 p-5 flex flex-col h-full min-h-[450px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-800 uppercase tracking-wider">Active Listings Directory</h4>
                <p className="text-xs text-gray-400 mt-0.5">Feature active items with one click</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input 
                type="text"
                placeholder="Search active listings by title or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
              />
            </div>

            {/* Scrollable Listings List */}
            <div className="flex-1 overflow-y-auto max-h-[320px] space-y-2 pr-1">
              {filteredActiveAuctions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-gray-400">
                  <p>No active auctions found.</p>
                  {searchTerm && <p className="text-xs text-gray-300 mt-1">Try a different search term.</p>}
                </div>
              ) : (
                filteredActiveAuctions.map((auction) => {
                  const isFeatured = auctions.some(f => f.id === auction.id);
                  return (
                    <div key={auction.id} className="flex items-center justify-between p-2.5 bg-white hover:border-gray-200 rounded-xl border border-gray-100 transition-all shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                          {auction.images?.[0] ? (
                            <Image src={auction.images[0]} alt={auction.title} fill sizes="40px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-gray-900 truncate leading-snug">{auction.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-primary-600">৳{auction.currentPrice.toLocaleString()}</span>
                            <span className="text-gray-300 text-[10px]">•</span>
                            <button
                              onClick={() => handleCopyId(auction.id)}
                              className="text-[10px] font-mono text-gray-400 hover:text-indigo-600 hover:underline flex items-center gap-0.5 select-all"
                              title="Copy ID"
                            >
                              <span>{auction.id.slice(0, 8)}...</span>
                              {copiedId === auction.id ? (
                                <Check className="w-2.5 h-2.5 text-green-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* External View Link */}
                        <a 
                          href={`/auctions/${auction.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View on site"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Feature Toggle Star Button */}
                        <button
                          onClick={() => handleToggleFeatured(auction.id)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isFeatured 
                              ? "bg-amber-500/10 text-amber-500 border-amber-300 hover:bg-amber-500/20" 
                              : "bg-white text-gray-400 border-gray-100 hover:text-amber-500 hover:border-amber-200"
                          }`}
                          title={isFeatured ? "Remove from Featured" : "Add to Featured"}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFeatured ? "fill-amber-500" : ""}`} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      </div>

    </div>
  );
}
