// Client/src/components/products/ProductCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type ProductCardProps = {
  id: number;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;

  vendorSlug?: string | null;
  vendorName?: string | null;
};

export default function ProductCard({
                                      id,
                                      slug,
                                      name,
                                      imageUrl,
                                      price,
                                      salePrice,
                                      vendorSlug,
                                      vendorName,
                                    }: Readonly<ProductCardProps>): React.ReactElement {
  const productHref = slug ? `/products/${encodeURIComponent(slug)}` : `/products/${id}`;
  const vendorHref = vendorSlug ? `/vendors/${encodeURIComponent(vendorSlug)}` : undefined;

  const onSale =
    typeof salePrice === 'number' &&
    Number.isFinite(salePrice) &&
    salePrice > 0 &&
    salePrice < price;

  const vendorText = vendorSlug ?? vendorName ?? 'Unknown vendor';

  return (
    <div
      className="group block rounded-2xl overflow-hidden border hover:shadow-md transition-shadow shadow-[0_6px_12.5px_var(--theme-shadow-onSale)]"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
    >
      {/* Image → product detail */}
      <Link
        to={productHref}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-[var(--theme-surface)]"
      >
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

        {/* On Sale badge */}
        {onSale && (
          <span
            className="absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shadow"
            style={{ background: 'var(--theme-button-yellow)', color: 'var(--theme-text-black)' }}
            aria-label="On sale"
          >
            On Sale
          </span>
        )}
      </Link>

      <div className="p-3">
        {/* Title → product detail */}
        <Link
          to={productHref}
          className="truncate font-semibold text-[var(--theme-text)] block"
          aria-label={`View product: ${name}`}
        >
          {name}
        </Link>

        {/* NEW: Always show "Sold by: ..." (link if we have a slug) */}
        <div className="mt-0.5 text-xs text-[var(--theme-text)]">
          <span className="opacity-75">Sold by:</span>{' '}
          {vendorHref ? (
            <Link
              to={vendorHref}
              className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
              aria-label={`View vendor storefront: ${vendorText}`}
            >
              {vendorText}
            </Link>
          ) : (
            <span className="font-medium">{vendorText}</span>
          )}
        </div>

        {/* Price */}
        <div className="mt-1">
          {salePrice != null ? (
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-[var(--theme-success)]">
                {usdFmt.format(salePrice)}
              </span>
              <span className="text-xs line-through text-[var(--theme-muted)]">
                {usdFmt.format(price)}
              </span>
            </div>
          ) : (
            <span className="font-bold text-[var(--theme-success)]">
              {usdFmt.format(price)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
