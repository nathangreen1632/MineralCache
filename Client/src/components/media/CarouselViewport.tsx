// Client/src/components/media/CarouselViewport.tsx
import React from 'react';

export default function CarouselViewport({
                                           images,
                                           index,
                                           heightClass = 'h-[28rem]', // default taller height
                                         }: Readonly<{ images: string[]; index: number; heightClass?: string }>): React.ReactElement {
  return (
    <div
      className={['w-full transition-transform duration-700 ease-out flex', heightClass].join(' ')}
      style={{ transform: `translateX(-${index * 100}%)` }}
    >
      {images.map((src, i) => (
        <div key={src} className="min-w-full h-full">
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-fill"
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}
