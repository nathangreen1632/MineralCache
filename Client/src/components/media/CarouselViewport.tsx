import React from 'react';

export default function CarouselViewport({
                                           images,
                                           index,
                                         }: Readonly<{ images: string[]; index: number; heightClass: string }>): React.ReactElement {
  return (
    <div
      className="h-full w-full transition-transform duration-700 ease-out flex"
      style={{ transform: `translateX(-${index * 100}%)` }}
    >
      {images.map((src, i) => (
        <div key={src} className="min-w-full h-full">
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}
