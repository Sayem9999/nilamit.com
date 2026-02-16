'use client';

import { useState, useEffect } from 'react';
import { getUserReviews } from '@/actions/review';
import { Star, MessageSquare, Clock, User } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';

interface ReviewListProps {
  userId: string;
}

export function ReviewList({ userId }: ReviewListProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const data = await getUserReviews(userId);
        setReviews(data);
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-gray-50 h-32 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-100">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Star className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">No reviews received yet.</p>
        <p className="text-xs text-gray-400 mt-1">Complete your first transaction to get feedback!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center">
                {review.from.image ? (
                  <img src={review.from.image} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <User className="w-4 h-4 text-primary-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{review.from.name || 'User'}</p>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                  <MessageSquare className="w-3 h-3" />
                  Reviewed on {review.auction.title}
                </div>
              </div>
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          
          {review.comment && (
            <p className="text-sm text-gray-600 font-medium bg-gray-50/50 p-3 rounded-xl border border-gray-50">
              "{review.comment}"
            </p>
          )}
          
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(review.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
