'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { bannersService, Banner } from '@/lib/banners-service';

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 50;

// Per-banner text styling override set by the admin (textColor hex, fontStyle
// 'display'|'sans') - falls back to the default cream text / display font when unset.
function bannerTextStyle(banner: Banner) {
  return {
    fontClass: banner.fontStyle === 'sans' ? 'font-sans' : 'font-display',
    style: banner.textColor ? { color: banner.textColor } : undefined,
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const count = banners.length;

  const goTo = (i: number) => setIndex(((i % count) + count) % count);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // Autoplay pauses on hover (desktop) and is skipped entirely under
  // prefers-reduced-motion, per the accessibility requirement.
  useEffect(() => {
    if (count < 2 || isPaused || reducedMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count, isPaused, reducedMotion]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    setDragOffset(e.clientX - dragStartX.current);
  };
  const endDrag = () => {
    if (dragStartX.current === null) return;
    if (dragOffset > SWIPE_THRESHOLD_PX) prev();
    else if (dragOffset < -SWIPE_THRESHOLD_PX) next();
    dragStartX.current = null;
    setDragOffset(0);
  };

  const isDragging = dragStartX.current !== null;

  return (
    <div
      className="relative w-full h-full min-h-[320px] md:min-h-[420px] overflow-hidden rounded-lg bg-neutral-900 select-none touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        className="flex h-full"
        style={{
          width: `${count * 100}%`,
          transform: `translateX(calc(${(-index * 100) / count}% + ${dragOffset}px))`,
          transition: isDragging || reducedMotion ? 'none' : 'transform 0.5s ease',
        }}
      >
        {banners.map((banner, i) => {
          const { fontClass, style: textStyle } = bannerTextStyle(banner);
          return (
          <div key={banner.id} className="relative h-full" style={{ width: `${100 / count}%` }}>
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              fill
              sizes="100vw"
              priority={i === 0}
              className={`object-cover ${banner.mobileImageUrl ? 'hidden sm:block' : ''}`}
            />
            {banner.mobileImageUrl && (
              <Image
                src={banner.mobileImageUrl}
                alt={banner.title}
                fill
                sizes="100vw"
                priority={i === 0}
                className="object-cover sm:hidden"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-10 text-cream">
              {banner.badgeText && (
                <span className="inline-block w-fit mb-3 bg-accent-red text-cream text-xs font-bold tracking-wide px-3 py-1 rounded-full">
                  {banner.badgeText}
                </span>
              )}
              <h2 className={`text-3xl md:text-5xl font-bold mb-2 ${fontClass}`} style={textStyle}>{banner.title}</h2>
              {banner.subtitle && <p className="text-lg md:text-2xl font-semibold mb-4" style={textStyle}>{banner.subtitle}</p>}
              {banner.ctaText && banner.ctaUrl && (
                <Link
                  href={banner.ctaUrl}
                  className="inline-block w-fit px-6 py-2.5 bg-cream text-black font-semibold rounded hover:bg-opacity-90 transition-all"
                >
                  {banner.ctaText}
                </Link>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-cream text-xl hover:bg-black/60 transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-cream text-xl hover:bg-black/60 transition-colors"
          >
            ›
          </button>
          <div className="absolute bottom-3 right-4 z-10 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-accent-red' : 'bg-cream/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SidebarCard({ banner, variant }: { banner: Banner; variant: 'stack' | 'strip' }) {
  const wrapperClass = variant === 'stack' ? 'flex-1 min-h-[90px]' : 'w-[200px] h-40 flex-shrink-0 snap-start';
  const { fontClass, style: textStyle } = bannerTextStyle(banner);

  const inner = (
    <div className="group relative rounded-lg overflow-hidden bg-neutral-900 h-full">
      <Image
        src={banner.imageUrl}
        alt={banner.title}
        fill
        sizes="(min-width: 1024px) 25vw, 45vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="relative z-10 h-full flex flex-col justify-end p-3">
        {banner.badgeText && (
          <span className="inline-block w-fit mb-1 bg-accent-red text-cream text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full">
            {banner.badgeText}
          </span>
        )}
        <p className={`text-sm font-semibold text-cream leading-tight ${fontClass}`} style={textStyle}>{banner.title}</p>
        {banner.subtitle && <p className="text-xs text-cream/90 leading-tight" style={textStyle}>{banner.subtitle}</p>}
        {banner.ctaText && <span className="text-xs font-medium text-cream underline mt-1 inline-block">{banner.ctaText}</span>}
      </div>
    </div>
  );

  return banner.ctaUrl ? (
    <Link href={banner.ctaUrl} className={wrapperClass}>{inner}</Link>
  ) : (
    <div className={wrapperClass}>{inner}</div>
  );
}

function StripTile({ banner }: { banner: Banner }) {
  const { fontClass, style: textStyle } = bannerTextStyle(banner);
  const content = (
    <div className="relative h-24 sm:h-28 bg-neutral-900 text-cream rounded px-4 py-4 hover:bg-neutral-800 transition-colors overflow-hidden">
      {banner.badgeText && (
        <p className="text-[10px] uppercase tracking-wide text-accent-red font-semibold mb-1">{banner.badgeText}</p>
      )}
      <p className={`text-sm font-semibold ${fontClass}`} style={textStyle}>{banner.title}</p>
      {banner.subtitle && <p className="text-xs text-gray-300 mt-0.5" style={textStyle}>{banner.subtitle}</p>}
    </div>
  );
  return banner.ctaUrl ? <Link href={banner.ctaUrl} className="block h-full">{content}</Link> : content;
}

/**
 * Fully admin-managed homepage promo area (image, text, offer badge, and
 * button - everything is editable from Admin > Homepage Banners, nothing
 * hardcoded). Renders nothing for a placement that has no active banners -
 * never shows a fake/placeholder offer.
 */
export const HomeBanners: React.FC = () => {
  const [banners, setBanners] = useState<Banner[] | null>(null);

  useEffect(() => {
    bannersService.getActive().then(setBanners);
  }, []);

  // The fixed header needs this top clearance on every homepage visit, whether
  // or not there's banner content yet to show inside it (an admin with no
  // banners configured yet must not see the next section hidden behind the header).
  if (banners === null) {
    return <div className="w-full h-[320px] md:h-[420px] bg-gray-100 animate-pulse rounded-lg mx-auto max-w-7xl mt-20 md:mt-24" />;
  }

  const hero = banners.filter((b) => b.placement === 'hero');
  const sidebar = banners.filter((b) => b.placement === 'sidebar');
  const strip = banners.filter((b) => b.placement === 'strip');

  if (hero.length === 0 && sidebar.length === 0 && strip.length === 0) {
    return <div className="mt-20 md:mt-24" />;
  }

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-20 md:mt-24">
      {(hero.length > 0 || sidebar.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {hero.length > 0 && (
            <div className="lg:col-span-3">
              <HeroCarousel banners={hero} />
            </div>
          )}
          {sidebar.length > 0 && (
            <div className={hero.length > 0 ? 'lg:col-span-1' : 'lg:col-span-4'}>
              {/* Desktop/tablet: vertical stack that exactly fills the hero's height */}
              <div className="hidden lg:flex lg:flex-col h-full gap-3">
                {sidebar.map((b) => (
                  <SidebarCard key={b.id} banner={b} variant="stack" />
                ))}
              </div>
              {/* Mobile: horizontally-scrollable strip, shown below the hero */}
              <div className="flex lg:hidden overflow-x-auto snap-x snap-mandatory gap-3 mt-4 pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
                {sidebar.map((b) => (
                  <SidebarCard key={b.id} banner={b} variant="strip" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {strip.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          {strip.map((b) => (
            <StripTile key={b.id} banner={b} />
          ))}
        </div>
      )}
    </section>
  );
};
