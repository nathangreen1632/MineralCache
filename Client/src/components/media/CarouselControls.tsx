// Client/src/components/media/CarouselControls.tsx
import React from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

type Props = {
  canNavigate: boolean;
  onPrev: () => void;
  onNext: () => void;
  paused: boolean;
  onTogglePause: () => void;
};

export default function CarouselControls({
                                           canNavigate,
                                           onPrev,
                                           onNext,
                                           paused,
                                           onTogglePause,
                                         }: Readonly<Props>): React.ReactElement | null {
  if (!canNavigate) return null;

  const btnBase =
    'inline-flex items-center justify-center rounded-full h-10 w-10 ' +
    'bg-[var(--theme-surface)] text-[var(--theme-text)] ' +
    'ring-1 ring-inset ring-[var(--theme-border)] ' +
    'hover:bg-[var(--theme-card)] ' +
    'focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-[var(--theme-surface)] ' +
    'shadow-[0_6px_18px_var(--theme-shadow)]';

  return (
    <>
      {/* Mobile-first: centered control bar */}
      <div
        role="text"
        aria-label="Carousel controls"
        className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2 px-2 sm:hidden"
      >
        <button
          type="button"
          aria-label="Previous slide"
          onClick={onPrev}
          className={btnBase}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={paused ? 'Play carousel' : 'Pause carousel'}
          aria-pressed={paused}
          onClick={onTogglePause}
          className={btnBase}
        >
          {paused ? (
            <Play className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Pause className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          aria-label="Next slide"
          onClick={onNext}
          className={btnBase}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* From sm+: overlaid buttons (desktop/tablet) */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={onPrev}
        className={`${btnBase} hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2`}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label="Next slide"
        onClick={onNext}
        className={`${btnBase} hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2`}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label={paused ? 'Play carousel' : 'Pause carousel'}
        aria-pressed={paused}
        onClick={onTogglePause}
        className={`${btnBase} hidden sm:flex absolute bottom-3 left-3`}
      >
        {paused ? (
          <Play className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pause className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
