"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/actions/review";
import toast from "react-hot-toast";

interface QuickReviewProps {
  auctionId: string;
  toId: string;
  onComplete?: () => void;
}

export function QuickReview({ auctionId, toId, onComplete }: QuickReviewProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReview({
        auctionId,
        toId,
        rating,
        comment: comment.trim() || undefined,
      });
      if (result.success) {
        toast.success("Review submitted!");
        onComplete?.();
      } else {
        toast.error(result.error || "Failed to submit review");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="font-heading font-semibold text-gray-900 mb-3">
        Rate this seller
      </h3>
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 transition-colors ${star <= (hover || rating) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-500 ml-2 self-center">
            {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
          </span>
        )}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)"
        rows={3}
        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-3"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </div>
  );
}
