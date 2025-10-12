// Client/src/components/auctions/AuctionFilters.tsx
import React from 'react';

type Vendor = { id: number; name: string };

type Filters = {
  vendorId?: number | null;
  species?: string;
  synthetic?: boolean | null;
};

type Props = Readonly<{
  value: Filters;
  onChange: (next: Filters) => void;
  vendors?: Vendor[]; // optional; pass if you have them
  className?: string;
}>;

export default function AuctionFilters({ value, onChange, vendors, className }: Props): React.ReactElement {
  function set<K extends keyof Filters>(k: K, v: Filters[K]) {
    onChange({ ...value, [k]: v });
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="grid gap-1">
          <label htmlFor="vendor" className="text-sm">Vendor</label>
          <select
            id="vendor"
            value={value.vendorId ?? ''}
            onChange={(e) => set('vendorId', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2"
          >
            <option value="">All vendors</option>
            {(vendors ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label htmlFor="species" className="text-sm">Species</label>
          <input
            id="species"
            placeholder="e.g. quartz"
            value={value.species ?? ''}
            onChange={(e) => set('species', e.target.value)}
            className="rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="synthetic" className="text-sm">Synthetic</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="synthetic"
                checked={value.synthetic === null || value.synthetic === undefined}
                onChange={() => set('synthetic', null)}
              />
              <span>Any</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="synthetic"
                checked={value.synthetic === true}
                onChange={() => set('synthetic', true)}
              />
              <span>Yes</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="synthetic"
                checked={value.synthetic === false}
                onChange={() => set('synthetic', false)}
              />
              <span>No</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
