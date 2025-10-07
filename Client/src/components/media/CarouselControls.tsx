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
  return (
    <>
      <button
        type="button"
        aria-label="Previous slide"
        onClick={onPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 ring-1 ring-inset"
        style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={onNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 ring-1 ring-inset"
        style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label={paused ? 'Play carousel' : 'Pause carousel'}
        onClick={onTogglePause}
        className="absolute bottom-3 left-3 rounded-full p-2 ring-1 ring-inset"
        style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </button>
    </>
  );
}
