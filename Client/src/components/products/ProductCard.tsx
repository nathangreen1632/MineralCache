import React from 'react';
import { Link } from 'react-router-dom';

export type ProductCardProps = {
  id: number;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;
};

export default function ProductCard({
                                      id, slug, name, imageUrl, price, salePrice,
                                    }: Readonly<ProductCardProps>): React.ReactElement {
  const href = slug ? `/products/${encodeURIComponent(slug)}` : `/products/${id}`;

  return (
    <Link
      to={href}
      className="group block rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--theme-surface)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-sm text-[var(--theme-muted)]">
            No image
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="truncate font-semibold text-[var(--theme-text)]">{name}</div>
        <div className="mt-1">
          {salePrice != null ? (
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-[var(--theme-success)]">${salePrice.toFixed(2)}</span>
              <span className="text-xs line-through text-[var(--theme-muted)]">${price.toFixed(2)}</span>
            </div>
          ) : (
            <span className="font-bold text-[var(--theme-text)]">${price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
