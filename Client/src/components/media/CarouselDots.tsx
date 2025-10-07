// Client/src/components/media/CarouselDots.tsx
import React from 'react';

type Props = {
  ids: string[];
  index: number;
  onSelect: (i: number) => void;
};

export default function CarouselDots({
                                       ids,
                                       index,
                                       onSelect,
                                     }: Readonly<Props>): React.ReactElement | null {
  if (!ids || ids.length <= 1) return null;

  const baseBtn =
    'inline-block rounded-full transition-[opacity,transform,width] duration-200 ' +
    // Mobile-first: slightly larger tap targets
    'h-3 w-6 sm:h-2 sm:w-5 md:h-1.5 md:w-4 ' +
    // Tokens + states
    'bg-[var(--theme-text)] ' +
    'focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-[var(--theme-surface)]';

  const activeBtn = 'opacity-100';
  const inactiveBtn = 'opacity-50 hover:opacity-80';

  return (
    <div
      className="flex items-center justify-center gap-2 px-2"
      aria-label="Slide selector"
      role="text"
    >
      {ids.map((id, i) => (
        <button
          key={id}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === index ? 'true' : undefined}
          onClick={() => onSelect(i)}
          className={[baseBtn, i === index ? activeBtn : inactiveBtn].join(' ')}
        />
      ))}
    </div>
  );
}
