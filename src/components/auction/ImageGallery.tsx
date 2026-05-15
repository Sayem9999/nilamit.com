"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  // "Adjusting state during render" pattern (React docs): when the parent
  // swaps to a different gallery we reset the index inline instead of in an
  // effect. This avoids the setState-in-effect lint warning and the extra
  // render the effect would cause, and crucially prevents an out-of-bounds
  // `images[currentIndex]` read on the first render after the swap.
  const [trackedImages, setTrackedImages] = useState(images);
  const [currentIndex, setCurrentIndex] = useState(0);
  if (images !== trackedImages) {
    setTrackedImages(images);
    setCurrentIndex(0);
  }

  if (!images || images.length === 0) {
    return (
      <div className="relative aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100/50 shadow-sm">
        <Image
          src="https://images.unsplash.com/photo-1560393464-5c69a73c5770?q=80&w=800&auto=format&fit=crop"
          alt={title}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image Container */}
      <div className="relative aspect-[4/3] sm:aspect-[4/3] lg:aspect-square rounded-3xl overflow-hidden bg-gray-100 group shadow-sm border border-gray-100/50">
        <Image
          src={images[currentIndex]}
          alt={`${title} - Image ${currentIndex + 1}`}
          fill
          priority={currentIndex === 0}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 ${"group-hover:scale-105"}`}
        />

        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 text-gray-800 hover:bg-white backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 text-gray-800 hover:bg-white backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Index Indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all snap-start ${
                index === currentIndex
                  ? "border-primary-500 scale-95 shadow-md"
                  : "border-transparent hover:border-primary-300 opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={image.includes('alt=media') ? image.replace(/(\.[\w\d_-]+)(\?alt=media.*)?$/i, '_400x400$1$2') : image}
                alt={`${title} thumbnail ${index + 1}`}
                fill
                sizes="(max-width: 768px) 80px, 96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
