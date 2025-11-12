import React from 'react';
import logoLight from '../../public/mc_logo_light1.webp';
import logoDark from '../../public/mc_logo_dark1.webp';

export default function BrandLogo(props: Readonly<{ className?: string; alt?: string }>): React.ReactElement {
  const cls = props.className ?? '';
  const alt = props.alt ?? 'Mineral Cache';
  return (
    <>
      <img src={logoLight} alt={alt} className={['mc-only-dark', cls].join(' ')} style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }} />
      <img src={logoDark}  alt={alt} className={['mc-only-light',  cls].join(' ')} style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }} />
    </>
  );
}
