'use client';

import { useState } from 'react';
import { updateSystemConfig, toggleFeaturedAuction } from '@/actions/admin-content';
import { Loader2, Plus, Trash2, Save, Image as ImageIcon } from 'lucide-react';
import { ImageUpload } from '@/components/upload/ImageUpload';
import Image from 'next/image';

interface ContentTabProps {
  initialConfig: any;
  featuredAuctions: any[];
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
        heroImage: config.heroImage,
        announcement: config.announcement,
        showAnnouncement: config.showAnnouncement,
      });
      alert('Content updated successfully!');
    } catch (e: any) {
      alert('Failed to update content: ' + e.message);
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
    } catch (e: any) {
        alert('Error: ' + e.message);
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
                auctions.map((auction: any) => (
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
