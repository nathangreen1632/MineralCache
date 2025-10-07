// Client/src/components/media/CarouselViewport.tsx
import React from 'react';

type Props = {
  images: string[];
  index: number;
  /** Mobile-first height; can be overridden by parent */
  heightClass?: string;
};

export default function CarouselViewport({
                                           images,
                                           index,
                                           heightClass = 'h-72 sm:h-80 md:h-[28rem] lg:h-[36rem] xl:h-[44rem]',
                                         }: Readonly<Props>): React.ReactElement {
  return (
    <div
      className={[
        'w-full h-full flex transition-transform duration-700 ease-out will-change-transform',
        'motion-reduce:transition-none',
        heightClass,
      ].join(' ')}
      style={{ transform: `translateX(-${index * 100}%)` }}
    >
      {images.map((src, i) => (
        <div key={src} className="min-w-full h-full">
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="block h-full w-full object-contain md:object-fill object-center select-none pointer-events-none"
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
