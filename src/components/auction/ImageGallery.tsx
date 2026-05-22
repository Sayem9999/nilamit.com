"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const FALLBACK_IMAGE = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNjAwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZjhmYWZjIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNlMmU4ZjAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJicmFuZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMzYjgyZjYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFkNGVkOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSJ1cmwoI2JnKSIgLz4KICA8Y2lyY2xlIGN4PSI0MDAiIGN5PSIyNzAiIHI9IjgwIiBmaWxsPSJ1cmwoI2JyYW5kKSIgLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzNjgsIDIzOCkgc2NhbGUoMi42NikiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIj4KICAgIDxwYXRoIGQ9Im0xNCAxMy01IDVNOSAxM2w1IDVNMTYgMTZsLTMuNS0zLjVNNiA2bDMuNSAzLjUiIC8+CiAgICA8cGF0aCBkPSJtOCAyIDggOC0yIDItOC04WiIgLz4KICAgIDxwYXRoIGQ9Im0xMSAxMS00IDQiIC8+CiAgICA8cGF0aCBkPSJNMjEgMjFoLTYiIC8+CiAgPC9nPgogIDx0ZXh0IHg9IjQwMCIgeT0iNDIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI4IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMWUyOTNiIj5uaWxhbWl0PC90ZXh0PgogIDx0ZXh0IHg9IjQwMCIgeT0iNDU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmb250LXdlaWdodD0iNDAwIiBmaWxsPSIjNjQ3NDhiIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPg==";

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
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  if (images !== trackedImages) {
    setTrackedImages(images);
    setCurrentIndex(0);
    setFailedImages({});
  }

  const isValidImageUrl = (url: string) => {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/") || url.startsWith("data:");
  };

  const isMainImageBroken = failedImages[currentIndex] || !isValidImageUrl(images[currentIndex] || "");
  const mainImageSrc = isMainImageBroken
    ? FALLBACK_IMAGE
    : images[currentIndex];

  if (!images || images.length === 0) {
    return (
      <div className="relative aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100/50 shadow-sm">
        <Image
          src={FALLBACK_IMAGE}
          alt={title}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
          key={`${currentIndex}-${isMainImageBroken ? "broken" : "ok"}`}
          src={mainImageSrc}
          alt={`${title} - Image ${currentIndex + 1}`}
          fill
          priority={currentIndex === 0}
          unoptimized={isMainImageBroken}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 ${"group-hover:scale-105"}`}
          onError={() => setFailedImages((prev) => ({ ...prev, [currentIndex]: true }))}
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
          {images.map((image, index) => {
            const isThumbBroken = failedImages[index] || !isValidImageUrl(image);
            const thumbSrc = isThumbBroken
              ? FALLBACK_IMAGE
              : (image.includes('alt=media') ? image.replace(/(\.[\w\d_-]+)(\?alt=media.*)?$/i, '_400x400$1$2') : image);

            return (
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
                  key={`${index}-${isThumbBroken ? "broken" : "ok"}`}
                  src={thumbSrc}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  unoptimized={isThumbBroken}
                  sizes="(max-width: 768px) 80px, 96px"
                  className="object-cover"
                  onError={() => setFailedImages((prev) => ({ ...prev, [index]: true }))}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
