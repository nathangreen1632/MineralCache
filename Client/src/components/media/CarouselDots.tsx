// Client/src/components/media/CarouselDots.tsx

import React from 'react';

export default function CarouselDots({
                                       ids,
                                       index,
                                       onSelect,
                                     }: Readonly<{ ids: string[]; index: number; onSelect: (i: number) => void }>): React.ReactElement | null {
  if (!ids || ids.length <= 1) return null;

  return (
    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5" aria-label="Slide selector">
      {ids.map((id, i) => (
        <button
          key={id}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === index ? 'true' : undefined}
          onClick={() => onSelect(i)}
          className={[
            'inline-block h-1.5 w-4 rounded-full transition-opacity focus:outline-none focus:ring-2',
            i === index ? 'opacity-100' : 'opacity-50',
          ].join(' ')}
          style={{ background: 'var(--theme-text)' }}
        />
      ))}
    </div>
  );
}
