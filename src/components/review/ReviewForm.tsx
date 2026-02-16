'use client';

import { useState, useTransition } from 'react';
import { submitReview } from '@/actions/review';
import { Star, MessageSquare, Send } from 'lucide-react';

interface ReviewFormProps {
  auctionId: string;
  toId: string;
  recipientName: string;
  onSuccess?: () => void;
}

export function ReviewForm({ auctionId, toId, recipientName, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitReview({
        auctionId,
        toId,
        rating,
        comment,
      });

      if (result.success) {
        setSuccess(true);
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to submit review');
      }
    });
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Star className="w-8 h-8 text-green-600 fill-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
        <p className="text-green-700">Your feedback helps keep Nilamit safe and reliable.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8">
      <div className="mb-6">
        <h3 className="text-2xl font-black text-gray-900 leading-tight">
          How was your experience with <span className="text-primary-600">{recipientName}</span>?
        </h3>
        <p className="text-gray-500 mt-2 font-medium">Your rating directly affects their reputation score.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Star Rating */}
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Rating</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    (hoveredRating || rating) >= star
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-200'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 text-sm font-bold text-gray-700">
            {rating === 5 && "Excellent (Highly Recommended)"}
            {rating === 4 && "Good (Reliable)"}
            {rating === 3 && "Average"}
            {rating === 2 && "Poor"}
            {rating === 1 && "Very Poor"}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Comment (Optional)</label>
          <div className="relative">
            <MessageSquare className="absolute top-4 left-4 w-5 h-5 text-gray-300" />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about the transaction, communication, or item quality..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 min-h-[120px] focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none text-gray-900 font-medium"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex gap-2 items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 group"
        >
          {isPending ? (
            <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <>
              Submit Review 
              <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
