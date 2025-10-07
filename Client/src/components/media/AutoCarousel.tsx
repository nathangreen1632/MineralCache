// Client/src/components/media/AutoCarousel.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import CarouselViewport from './CarouselViewport';
import CarouselDots from './CarouselDots';
import CarouselControls from './CarouselControls';

type AutoCarouselProps = {
  images: string[];
  intervalMs?: number;
  /** Controls overall height; mobile-first with larger breakpoints added */
  heightClass?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function AutoCarousel({
                                       images,
                                       intervalMs = 5000,
                                       // ⬇️ Mobile-first height: compact on small screens, scales up responsively
                                       heightClass = 'h-72 sm:h-80 md:h-[28rem] lg:h-[36rem] xl:h-[44rem]',
                                       ctaHref,
                                       ctaLabel,
                                     }: Readonly<AutoCarouselProps>): React.ReactElement | null {
  // De-dupe + drop empties
  const list = useMemo(() => Array.from(new Set(images.filter(Boolean))), [images]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const next = useCallback(() => {
    const len = Math.max(list.length, 1);
    setIdx((i) => (i + 1) % len);
  }, [list.length]);

  const prev = useCallback(() => {
    const len = Math.max(list.length, 1);
    setIdx((i) => (i - 1 + len) % len);
  }, [list.length]);

  // Auto-advance (respects pause + reduced motion)
  useEffect(() => {
    if (list.length <= 1) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) return;

    function tick() {
      if (!paused) next();
      timer.current = window.setTimeout(tick, intervalMs);
    }
    timer.current = window.setTimeout(tick, intervalMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [list.length, intervalMs, paused, next]);

  if (list.length === 0) return null;

  return (
    <>
      <section
        className={[
          // container
          'relative w-full overflow-hidden rounded-2xl border shadow-[0_10px_30px_var(--theme-shadow)] mt-8 sm:mt-12',
          'border-[var(--theme-border)] bg-[var(--theme-card)]',
          heightClass,
        ].join(' ')}
        aria-label="Featured images"
        role="text"
        aria-roledescription="carousel"
        aria-live="off"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <CarouselViewport images={list} index={idx} heightClass={heightClass} />

        {/* Controls are hidden on very small screens for a cleaner mobile layout */}
        <div className="hidden sm:block">
          <CarouselControls
            canNavigate={list.length > 1}
            onPrev={prev}
            onNext={next}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
          />
        </div>

        {/* Overlaid CTA (md+). Mobile version is rendered below the carousel. */}
        {ctaHref && ctaLabel && (
          <div className="hidden md:block absolute bottom-3 right-3">
            <Link
              to={ctaHref}
              className="inline-flex rounded-xl px-4 py-2 text-2xl font-semibold
                         bg-[var(--theme-button-yellow)] text-[var(--theme-text-white)]
                         hover:bg-[var(--theme-button-hover)]
                         focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-[var(--theme-focus)]
                         focus-visible:ring-offset-[var(--theme-surface)]"
              aria-label={ctaLabel}
            >
              {ctaLabel}
            </Link>
          </div>
        )}

        {/* Overlaid dots from sm+; mobile dots render below the section */}
        <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-2 sm:bottom-3">
          <CarouselDots ids={list} index={idx} onSelect={setIdx} />
        </div>
      </section>

      {/* Mobile-only dots (inline, below the carousel to avoid overlay crowding) */}
      <div className="sm:hidden mt-3 flex justify-center">
        <CarouselDots ids={list} index={idx} onSelect={setIdx} />
      </div>

      {/* Mobile CTA below the carousel (visible when provided) */}
      {ctaHref && ctaLabel && (
        <div className="mt-3 md:hidden flex justify-center">
          <Link
            to={ctaHref}
            className="inline-flex rounded-xl px-4 py-2 text-base font-semibold
                       bg-[var(--theme-button-yellow)] text-[var(--theme-text-white)]
                       hover:bg-[var(--theme-button-hover)]
                       focus-visible:ring-2 focus-visible:ring-offset-2
                       focus-visible:ring-[var(--theme-focus)]
                       focus-visible:ring-offset-[var(--theme-bg)]"
            aria-label={ctaLabel}
          >
            {ctaLabel}
          </Link>
        </div>
      )}
    </>
  );
}
