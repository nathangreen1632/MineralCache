import React, { useMemo, useState } from 'react';

type Props = {
  images: string[];
  label?: string;
  className?: string;
};

export default function ImageCarousel({
                                        images: rawImages,
                                        label = 'Image gallery',
                                        className = '',
                                      }: Readonly<Props>): React.ReactElement {
  // Dedupe while preserving order; drop falsy
  const images = useMemo(
    () => Array.from(new Set(rawImages.filter(Boolean))),
    [rawImages]
  );

  const [index, setIndex] = useState(0);
  const hasPrev = index > 0;
  const hasNext = index < Math.max(0, images.length - 1);
  const current = images[index] ?? '';

  function prev() {
    if (hasPrev) setIndex((i) => Math.max(0, i - 1));
  }
  function next() {
    if (hasNext) setIndex((i) => Math.min(images.length - 1, i + 1));
  }

  const borderOnly: React.CSSProperties = { borderColor: 'var(--theme-border)' };

  return (
    <section
      role="text"
      aria-roledescription="carousel"
      aria-label={label}
      className={`grid gap-3 ${className}`}
    >
      {/* SR announcement */}
      <p className="sr-only" aria-live="polite">
        {images.length ? `Image ${index + 1} of ${images.length}` : 'No images'}
      </p>

      {/* Viewport (non-interactive container) */}
      <div
        className="rounded-2xl border overflow-hidden aspect-square bg-[var(--theme-card-alt)] flex items-center justify-center"
        style={borderOnly}
      >
        {current ? (
          <img src={current} alt="" className="h-full w-full object-contain" />
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous image"
          onClick={prev}
          disabled={!hasPrev}
          className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset disabled:opacity-50"
          style={{
            ...borderOnly,
            background: 'var(--theme-surface)',
            color: 'var(--theme-text)',
          }}
        >
          Prev
        </button>
        <button
          type="button"
          aria-label="Next image"
          onClick={next}
          disabled={!hasNext}
          className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset disabled:opacity-50"
          style={{
            ...borderOnly,
            background: 'var(--theme-surface)',
            color: 'var(--theme-text)',
          }}
        >
          Next
        </button>
        <span className="ml-auto text-xs opacity-80" style={{ color: 'var(--theme-link)' }}>
          {images.length ? `Image ${index + 1} / ${images.length}` : '—'}
        </span>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto" role="menu" aria-label="Thumbnails">
          {images.map((u) => {
            const active = u === current;
            return (
              <button
                key={`thumb-${u}`}
                type="button"
                aria-label="Select image"
                aria-current={active ? 'true' : undefined}
                onClick={() => setIndex(images.indexOf(u))}
                className="shrink-0 rounded-lg border overflow-hidden focus-visible:ring-2"
                style={{
                  ...borderOnly,
                  boxShadow: active ? `0 0 0 2px var(--theme-focus) inset` : undefined,
                  opacity: active ? 1 : 0.85,
                }}
              >
                <img src={u} alt="" className="h-16 w-16 object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
