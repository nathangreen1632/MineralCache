// Client/src/components/products/ProductFilters.tsx
import React from 'react';

type Value = {
  category?: string;
  species?: string;
  synthetic?: boolean | null;
};

export default function ProductFilters({
                                         value,
                                         onChange,
                                         className,
                                       }: Readonly<{
  value: Value;
  onChange: (next: Value) => void;
  className?: string;
}>): React.ReactElement {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="grid gap-1">
          <label htmlFor="pf-category" className="text-sm">Category</label>
          <input
            id="pf-category"
            value={value.category ?? ''}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
            placeholder="e.g. quartz"
            className="w-[16rem] rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="pf-species" className="text-sm">Species</label>
          <input
            id="pf-species"
            value={value.species ?? ''}
            onChange={(e) => onChange({ ...value, species: e.target.value })}
            placeholder="e.g. amethyst"
            className="w-[16rem] rounded-xl border bg-[var(--theme-surface)] border-[var(--theme-border)] px-3 py-2"
          />
        </div>

        <div className="grid gap-1">
          <span className="text-sm">Synthetic</span>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pf-synth"
                checked={value.synthetic === null || value.synthetic === undefined}
                onChange={() => onChange({ ...value, synthetic: null })}
              />
              <span>Any</span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pf-synth"
                checked={value.synthetic === false}
                onChange={() => onChange({ ...value, synthetic: false })}
              />
              <span>Natural</span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pf-synth"
                checked={value.synthetic === true}
                onChange={() => onChange({ ...value, synthetic: true })}
              />
              <span>Synthetic</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
