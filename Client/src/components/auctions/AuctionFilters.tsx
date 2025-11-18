// Client/src/components/auctions/AuctionFilters.tsx
import React from 'react';

export type Vendor = { id: number; name: string };

export type Filters = {
  vendorId?: number | null;
};

type Props = Readonly<{
  value: Filters;
  onChange: (next: Filters) => void;
  vendors?: Vendor[];
  className?: string;
  inline?: boolean;
}>;

export default function AuctionFilters({
                                         value,
                                         onChange,
                                         vendors = [],
                                         className = '',
                                         inline = false,
                                       }: Props): React.ReactElement {
  const sortedVendors = React.useMemo(
    () =>
      [...vendors].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [vendors]
  );

  const wrapper = inline
    ? 'flex items-center gap-2'
    : 'grid grid-cols-1 sm:grid-cols-3 gap-3';

  return (
    <div className={`${wrapper} ${className}`}>
      <div className={inline ? 'flex items-center gap-2' : 'grid gap-1'}>
        {!inline && (
          <label htmlFor="vendor" className="text-sm">
            Vendor
          </label>
        )}
        <div className="relative">
          <select
            id="vendor"
            value={value.vendorId == null ? '' : String(value.vendorId)}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({ ...value, vendorId: raw === '' ? null : Number(raw) });
            }}
            className="appearance-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] px-3 py-2 pr-8 outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            aria-label="Filter by vendor"
          >
            <option value="">All vendors</option>
            {sortedVendors.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name}
              </option>
            ))}
          </select>

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
