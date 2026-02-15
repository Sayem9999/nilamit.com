'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createAuction } from '@/actions/auction';
import { CATEGORIES } from '@/types';
import { ArrowLeft, ArrowRight, Upload, Check, AlertCircle } from 'lucide-react';

type Step = 'details' | 'pricing' | 'schedule' | 'review';

export default function CreateAuctionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({
    title: '',
    description: '',
    images: [''],
    category: 'electronics',
    startingPrice: 100,
    minBidIncrement: 10,
    startTime: '',
    endTime: '',
  });

  if (!session) {
    router.push('/login');
    return null;
  }

  const steps: Step[] = ['details', 'pricing', 'schedule', 'review'];
  const stepIndex = steps.indexOf(step);

  const handleSubmit = () => {
    setError('');
    startTransition(async () => {
      const result = await createAuction({
        ...form,
        images: form.images.filter(Boolean),
      });
      if (result.success && result.auction) {
        router.push(`/auctions/${result.auction.id}`);
      } else {
        setError(result.error || 'Failed to create auction.');
        if (result.error === 'PHONE_NOT_VERIFIED') {
          setError('Please verify your phone number before selling. Go to your Profile to verify.');
        }
      }
    });
  };

  const updateForm = (field: string, value: string | number | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading font-bold text-2xl text-gray-900 mb-2">Create Auction</h1>
      <p className="text-sm text-gray-500 mb-8">List your item for bidding</p>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i <= stepIndex ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-1 ${i < stepIndex ? 'bg-primary-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Item Details</h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g., iPhone 15 Pro Max 256GB"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Describe your item in detail..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateForm('category', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Image URLs</label>
              {form.images.map((img, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={img}
                    onChange={(e) => {
                      const newImages = [...form.images];
                      newImages[i] = e.target.value;
                      updateForm('images', newImages);
                    }}
                    placeholder="https://..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              ))}
              <button
                onClick={() => updateForm('images', [...form.images, ''])}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"
              >
                <Upload className="w-3 h-3" /> Add another image URL
              </button>
            </div>
          </div>
        )}

        {/* Step: Pricing */}
        {step === 'pricing' && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Pricing</h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Starting Price (৳)</label>
              <input
                type="number"
                value={form.startingPrice}
                onChange={(e) => updateForm('startingPrice', Number(e.target.value))}
                min={1}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm price focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Minimum Bid Increment (৳)</label>
              <input
                type="number"
                value={form.minBidIncrement}
                onChange={(e) => updateForm('minBidIncrement', Number(e.target.value))}
                min={1}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm price focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Each new bid must be at least this much higher than the current price.</p>
            </div>
          </div>
        )}

        {/* Step: Schedule */}
        {step === 'schedule' && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Schedule</h2>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Start Time</label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => updateForm('startTime', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">End Time</label>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => updateForm('endTime', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Anti-sniping: If a bid comes in the last 2 minutes, the auction extends automatically.</p>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Review & Publish</h2>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <div><strong className="text-gray-700">Title:</strong> <span className="text-gray-600">{form.title}</span></div>
              <div><strong className="text-gray-700">Category:</strong> <span className="text-gray-600">{form.category}</span></div>
              <div><strong className="text-gray-700">Starting Price:</strong> <span className="price text-primary-700">৳{form.startingPrice}</span></div>
              <div><strong className="text-gray-700">Min Increment:</strong> <span className="price text-gray-600">৳{form.minBidIncrement}</span></div>
              <div><strong className="text-gray-700">Duration:</strong> <span className="text-gray-600">{form.startTime} → {form.endTime}</span></div>
              <div><strong className="text-gray-700">Images:</strong> <span className="text-gray-600">{form.images.filter(Boolean).length} uploaded</span></div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
              By publishing, your auction goes live immediately. You cannot cancel once bids are placed.
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => stepIndex > 0 && setStep(steps[stepIndex - 1])}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2"
            >
              {isPending ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                'Publish Auction'
              )}
            </button>
          ) : (
            <button
              onClick={() => setStep(steps[stepIndex + 1])}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all flex items-center gap-1"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
