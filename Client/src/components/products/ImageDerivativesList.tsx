// Client/src/components/products/ImageDerivativesList.tsx
import React from 'react';
import type { UploadedFileMeta, ImageVariantMeta } from '../../types/productImages.types';

function humanBytes(n?: number | null): string {
  if (!n || n <= 0) return '—';
  const kb = 1024, mb = kb * 1024;
  if (n >= mb) return `${(n / mb).toFixed(2)} MB`;
  if (n >= kb) return `${(n / kb).toFixed(1)} KB`;
  return `${n} B`;
}

/** Small, deterministic string hash for stable React keys (no array index). */
function hashStable(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0; // force 32-bit
  }
  // base36 keeps it compact; add length to further reduce collision risk
  return `${s.length}-${Math.abs(h).toString(36)}`;
}

function fileKey(f: UploadedFileMeta): string {
  const base = `${f.name}|${f.type || ''}|${f.size || 0}`;
  return hashStable(base);
}

function variantKey(f: UploadedFileMeta, v: ImageVariantMeta): string {
  const dims = `${v.width ?? 0}x${v.height ?? 0}`;
  const bytes = `${v.bytes ?? 0}`;
  const url = v.url ?? '';
  const base = `${f.name}|${v.key}|${dims}|${bytes}|${url}`;
  return hashStable(base);
}

function VariantRow({ v }: Readonly<{ v: ImageVariantMeta }>) {
  const label = v.key === 'orig' ? 'Original' : `${v.key}px`;

  // (No nested ternary) — clear, linear logic
  let dims = '—';
  const hasW = typeof v.width === 'number' && v.width > 0;
  const hasH = typeof v.height === 'number' && v.height > 0;
  if (hasW && hasH) {
    dims = `${v.width}×${v.height}px`;
  } else if (hasW) {
    dims = `${v.width}px`;
  }

  const size = humanBytes(v.bytes);

  return (
    <div className="flex items-center justify-between rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="inline-flex min-w-[72px] justify-center rounded-lg px-2 py-1 text-sm font-semibold bg-[var(--theme-card)] border border-[var(--theme-border)]">
          {label}
        </span>
        <span className="text-sm opacity-80">{dims}</span>
      </div>
      <div className="text-sm tabular-nums opacity-80">{size}</div>
    </div>
  );
}

export default function ImageDerivativesList({
                                               files,
                                               className,
                                             }: Readonly<{ files: UploadedFileMeta[]; className?: string }>): React.ReactElement | null {
  if (!files?.length) return null;

  return (
    <div className={className}>
      <h3 className="mb-2 text-lg font-semibold">Generated image variants</h3>
      <div className="grid gap-6">
        {files.map((f) => {
          const variants =
            f.variants && f.variants.length > 0
              ? f.variants
              : [
                // Fallback presentation if API didn’t return variants
                { key: 'orig' as const, width: undefined, height: undefined, bytes: f.size },
              ];

          return (
            <div
              key={fileKey(f)}
              className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4 shadow-[0_10px_30px_var(--theme-shadow)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-medium">
                  {f.name}{' '}
                  <span className="ml-2 text-sm opacity-70">({f.type || 'image'})</span>
                </div>
                <div className="text-sm opacity-75">Original: {humanBytes(f.size)}</div>
              </div>

              {/* Optional thumbnails if URLs are present */}
              {variants.some((v) => v.url) && (
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {variants.map((v) =>
                    v.url ? (
                      <div
                        key={variantKey(f, v)}
                        className="rounded-xl overflow-hidden border border-[var(--theme-border)]"
                      >
                        <img
                          src={v.url ?? undefined}
                          alt={`${f.name} ${v.key}`}
                          className="block w-full h-auto"
                          loading="lazy"
                        />
                      </div>
                    ) : null
                  )}
                </div>
              )}

              <div className="grid gap-2">
                {variants.map((v) => (
                  <VariantRow key={variantKey(f, v)} v={v} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
