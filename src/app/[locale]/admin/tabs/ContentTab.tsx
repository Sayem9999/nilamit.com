'use client';

import { useState } from 'react';
import { updateSystemConfig, toggleFeaturedAuction } from '@/actions/admin-content';
import { Loader2, Trash2, Save, Image as ImageIcon } from 'lucide-react';
import { ImageUpload } from '@/components/upload/ImageUpload';
import Image from 'next/image';

interface ContentTabProps {
  initialConfig: { 
    heroTitle: string; 
    heroSubtitle: string; 
    heroImage: string | null; 
    announcement: string | null; 
    showAnnouncement: boolean;
    treasuryBkash: string | null;
    treasuryNagad: string | null;
  };
  featuredAuctions: { id: string; title: string; currentPrice: number; images: string[] }[];
}

export function ContentTab({ initialConfig, featuredAuctions }: ContentTabProps) {
  const [config, setConfig] = useState(initialConfig);
  const [auctions, setAuctions] = useState(featuredAuctions);
  const [isSaving, setIsSaving] = useState(false);
  const [newAuctionId, setNewAuctionId] = useState('');

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await updateSystemConfig({
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        heroImage: config.heroImage ?? undefined,
        announcement: config.announcement ?? undefined,
        showAnnouncement: config.showAnnouncement,
        treasuryBkash: config.treasuryBkash,
        treasuryNagad: config.treasuryNagad,
      });
      alert('Content updated successfully!');
    } catch (e: unknown) {
      alert('Failed to update content: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
        const res = await toggleFeaturedAuction(id);
        if (res.success) {
            if (res.isFeatured) {
                // It was added (we need to refresh list ideally, but for now simple alert or reload)
                // Since we don't return the full auction object, simplest is to reload or just optimistically update if we had the object
                window.location.reload(); 
            } else {
                setAuctions(prev => prev.filter(a => a.id !== id));
            }
        }
    } catch (e: unknown) {
        alert('Error: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Hero Section Manager */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            Homepage Banner
        </h3>
        <div className="space-y-4 max-w-2xl">
            <div>
                <label className="text-sm font-medium text-gray-700">Hero Title</label>
                <input 
                    type="text" 
                    value={config.heroTitle} 
                    onChange={e => setConfig({ ...config, heroTitle: e.target.value })}
                    className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div>
                <label className="text-sm font-medium text-gray-700">Hero Subtitle</label>
                <input 
                    type="text" 
                    value={config.heroSubtitle} 
                    onChange={e => setConfig({ ...config, heroSubtitle: e.target.value })}
                    className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
            </button>
        </div>
      </div>

      {/* 1.5 Treasury Configuration */}
      <div className="bg-white rounded-xl border border-emerald-100 p-6 shadow-sm">
        <h3 className="font-heading font-semibold text-lg text-emerald-900 mb-4 flex items-center gap-2">
            <Save className="w-5 h-5 text-emerald-600" />
            Official Treasury Accounts
        </h3>
        <p className="text-sm text-gray-500 mb-6">These numbers will be displayed in the Automated Checkout Gateway.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">bKash Merchant/Personal</label>
                <input 
                    type="text" 
                    value={config.treasuryBkash || ''} 
                    onChange={e => setConfig({ ...config, treasuryBkash: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full mt-1 px-4 py-2 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nagad Merchant/Personal</label>
                <input 
                    type="text" 
                    value={config.treasuryNagad || ''} 
                    onChange={e => setConfig({ ...config, treasuryNagad: e.target.value })}
                    placeholder="018XXXXXXXX"
                    className="w-full mt-1 px-4 py-2 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
            </div>
        </div>
        <div className="mt-6">
            <button 
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sync Treasury
            </button>
        </div>
      </div>

      {/* 2. Featured Auctions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Save className="w-5 h-5 text-amber-500" /> {/* Star icon replacement */}
            Featured Auctions
        </h3>
        
        {/* Add New */}
        <div className="flex gap-2 max-w-md mb-6">
            <input 
                type="text" 
                placeholder="Paste Auction ID" 
                value={newAuctionId}
                onChange={e => setNewAuctionId(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm"
            />
            <button 
                onClick={() => handleToggleFeatured(newAuctionId)}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-black"
            >
                Add
            </button>
        </div>

        {/* List */}
        <div className="space-y-3">
            {auctions.length === 0 ? (
                <p className="text-sm text-gray-500">No auctions featured yet.</p>
            ) : (
                auctions.map((auction) => (
                    <div key={auction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 relative rounded-md overflow-hidden bg-gray-200">
                                {auction.images?.[0] && <Image src={auction.images[0]} alt={auction.title} fill className="object-cover" />}
                            </div>
                            <div>
                                <p className="font-medium text-sm text-gray-900">{auction.title}</p>
                                <p className="text-xs text-gray-500">৳{auction.currentPrice}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleToggleFeatured(auction.id)}
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>

    </div>
  );
}
