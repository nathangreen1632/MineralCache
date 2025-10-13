import React from 'react';
import clsx from 'clsx';
import { Visa, Mastercard, Amex, Discover } from 'react-payment-logos/dist/flat';

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';
type Size = 'xs' | 'sm' | 'md' | 'lg';

type AcceptedCardsProps = {
  className?: string;
  size?: Size;
  brands?: CardBrand[];
};

const SIZES: Record<Size, { w: number; h: number; gap: string }> = {
  xs: { w: 32, h: 20, gap: 'gap-1' },
  sm: { w: 44, h: 28, gap: 'gap-2' },
  md: { w: 56, h: 36, gap: 'gap-3' },
  lg: { w: 72, h: 46, gap: 'gap-4' },
};

const DEFAULT_BRANDS: CardBrand[] = ['visa', 'mastercard', 'amex', 'discover'];

const ICONS: Record<CardBrand, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  visa: Visa,
  mastercard: Mastercard,
  amex: Amex,
  discover: Discover,
};

export default function AcceptedCards({
                                        className,
                                        size = 'xs',
                                        brands = DEFAULT_BRANDS,
                                      }: Readonly<AcceptedCardsProps>): React.ReactElement {
  const s = SIZES[size];
  return (
    <div
      role="text"
      aria-label={`Accepted cards: ${brands.join(', ')}`}
      className={clsx('flex flex-wrap items-center', s.gap, className)}
    >
      {brands.map((b) => {
        const Icon = ICONS[b];
        return <Icon key={b} width={s.w} height={s.h} aria-label={b} />;
      })}
    </div>
  );
}
