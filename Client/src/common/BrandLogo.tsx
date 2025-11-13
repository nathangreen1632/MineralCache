import React from 'react';

export default function BrandLogo(
  props: Readonly<{ className?: string; alt?: string }>
): React.ReactElement {
  const cls = props.className ?? '';
  const alt = props.alt ?? 'Mineral Cache';

  return (
    <>
      {/* Shown in dark mode (light logo) */}
      <img
        src="/mc_logo_light1.webp"
        alt={alt}
        className={['mc-only-dark', cls].join(' ')}
        style={{ filter: 'drop-shadow(2px 1px 1px var(--theme-shadow-carousel))' }}
      />

      {/* Shown in light mode (dark logo) */}
      <img
        src="/mc_logo_dark1.webp"
        alt={alt}
        className={['mc-only-light', cls].join(' ')}
        style={{ filter: 'drop-shadow(2px 1px 1px var(--theme-shadow-black))' }}
      />
    </>
  );
}