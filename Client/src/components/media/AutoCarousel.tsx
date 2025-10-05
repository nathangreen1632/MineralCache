// Client/src/components/media/AutoCarousel.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import CarouselViewport from './CarouselViewport';
import CarouselDots from './CarouselDots';
import CarouselControls from './CarouselControls';

type AutoCarouselProps = {
  images: string[];
  intervalMs?: number;
  heightClass?: string;  // controls overall height
  ctaHref?: string;
  ctaLabel?: string;
};

export default function AutoCarousel({
                                       images,
                                       intervalMs = 5000,
                                       // ⬇️ Taller, responsive default height
                                       heightClass = 'h-[28rem] md:h-[36rem] lg:h-[44rem]',
                                       ctaHref,
                                       ctaLabel,
                                     }: Readonly<AutoCarouselProps>): React.ReactElement | null {
  // De-dupe + drop empties
  const list = useMemo(() => Array.from(new Set(images.filter(Boolean))), [images]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const next = useCallback(
    () => setIdx((i) => (i + 1) % Math.max(list.length, 1)),
    [list.length]
  );
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + Math.max(list.length, 1)) % Math.max(list.length, 1)),
    [list.length]
  );

  // Auto-advance
  useEffect(() => {
    if (list.length <= 1) return;
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
    <section
      className={[
        'relative w-full overflow-hidden rounded-2xl border shadow-[0_10px_30px_var(--theme-shadow)] mt-12',
        'border-[var(--theme-border)] bg-[var(--theme-card)]',
        heightClass,
      ].join(' ')}
      aria-label="Featured vendor images"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <CarouselViewport images={list} index={idx} heightClass={heightClass} />

      <CarouselControls
        canNavigate={list.length > 1}
        onPrev={prev}
        onNext={next}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
      />

      {ctaHref && ctaLabel && (
        <div className="absolute bottom-3 right-3">
          <Link
            to={ctaHref}
            className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
          >
            {ctaLabel}
          </Link>
        </div>
      )}

      <CarouselDots ids={list} index={idx} onSelect={setIdx} />
    </section>
  );
}
