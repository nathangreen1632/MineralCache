import React from 'react';
import wordDark from '../assets/mc_logo_words_light.webp';
import wordLight from '../assets/mc_logo_words_dark.webp';

export default function BrandWordmark(props: Readonly<{ className?: string; alt?: string }>): React.ReactElement {
  const cls = props.className ?? '';
  const alt = props.alt ?? 'Mineral Cache';
  return (
    <>
      <img src={wordLight} alt={alt} className={['mc-only-dark', cls].join(' ')} />
      <img src={wordDark}  alt={alt} className={['mc-only-light',  cls].join(' ')} />
    </>
  );
}
