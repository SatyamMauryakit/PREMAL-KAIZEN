'use client';

import { useState, useEffect, useCallback } from 'react';

export interface GalleryImage {
  id: string;
  url: string;
  alt?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  productName: string;
}

/**
 * Product image gallery: hover-zoom on desktop, click-to-zoom full-screen modal
 * with prev/next + keyboard navigation, thumbnail strip. Pinch-to-zoom on mobile
 * is the browser's own native capability (not a hand-rolled gesture handler) -
 * the full-screen modal deliberately sets no `touch-action` restriction and never
 * calls preventDefault on touch events, and the site's viewport meta (Next's
 * default `width=device-width, initial-scale=1`) never disables user scaling, so
 * standard OS/browser pinch-zoom works on the enlarged image as-is.
 */
export function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [hoverZoom, setHoverZoom] = useState<{ x: number; y: number } | null>(null);

  const hasImages = images.length > 0;
  const current = hasImages ? images[selectedIndex] : null;

  const goPrev = useCallback(() => {
    setSelectedIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    setSelectedIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard navigation only while the full-screen viewer is open.
  useEffect(() => {
    if (!isZoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomOpen(false);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isZoomOpen, goPrev, goNext]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  if (!hasImages || !current) {
    return (
      <div className="w-full h-96 bg-gray-light flex items-center justify-center rounded-lg border border-gray-light">
        <span className="text-gray-medium">No image available</span>
      </div>
    );
  }

  return (
    <div>
      {/* Main image */}
      <div
        className="relative bg-white rounded-lg border border-gray-light overflow-hidden mb-4 group"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverZoom(null)}
      >
        <button
          type="button"
          onClick={() => setIsZoomOpen(true)}
          aria-label="Click to zoom"
          className="block w-full cursor-zoom-in md:overflow-hidden"
        >
          {/* Desktop: hover-zoom via CSS transform. Hidden on mobile - hover has no
              meaning on touch, and the full-screen viewer (native pinch-zoom) is the
              mobile zoom path instead. */}
          <img
            src={current.url}
            alt={current.alt || productName}
            className="hidden md:block w-full h-auto transition-transform duration-150 ease-out"
            style={
              hoverZoom
                ? { transform: 'scale(1.8)', transformOrigin: `${hoverZoom.x}% ${hoverZoom.y}%` }
                : undefined
            }
          />
          <img
            src={current.url}
            alt={current.alt || productName}
            className="md:hidden w-full h-auto"
          />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow text-lg"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow text-lg"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail navigation */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((image, idx) => (
            <button
              type="button"
              key={image.id}
              onClick={() => setSelectedIndex(idx)}
              aria-label={`View image ${idx + 1} of ${images.length}`}
              aria-current={selectedIndex === idx}
              className={`bg-white rounded border overflow-hidden transition-colors ${
                selectedIndex === idx ? 'border-black' : 'border-gray-light hover:border-black'
              }`}
            >
              <img
                src={image.url}
                alt={image.alt || productName}
                className="w-full h-24 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Full-screen zoom viewer */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center overflow-auto"
          onClick={() => setIsZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} - full-screen image viewer`}
        >
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            aria-label="Close image viewer"
            className="absolute top-4 right-4 text-white text-3xl w-10 h-10 flex items-center justify-center hover:opacity-70"
          >
            ×
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl w-12 h-12 flex items-center justify-center hover:opacity-70"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Next image"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl w-12 h-12 flex items-center justify-center hover:opacity-70"
              >
                ›
              </button>
            </>
          )}

          <img
            src={current.url}
            alt={current.alt || productName}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[95vw] max-h-[90vh] object-contain"
          />

          {images.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
              {selectedIndex + 1} / {images.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
