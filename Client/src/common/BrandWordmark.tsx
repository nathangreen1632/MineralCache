import React from 'react';

export default function BrandWordmark(
  props: Readonly<{ className?: string; alt?: string }>
): React.ReactElement {
  const cls = props.className ?? '';
  const alt = props.alt ?? 'Mineral Cache';

  return (
    <>
      {/* Shown in dark mode */}
      <img
        src="/mc_logo_words_dark.webp"
        alt={alt}
        className={['mc-only-dark', cls].join(' ')}
        style={{ filter: 'drop-shadow(6px 2px 3px var(--theme-shadow-carousel))' }}
      />

      {/* Shown in light mode */}
      <img
        src="/mc_logo_words_light.webp"
        alt={alt}
        className={['mc-only-light', cls].join(' ')}
        style={{ filter: 'drop-shadow(6px 2px 3px var(--theme-shadow-black))' }}
      />
    </>
  );
}
