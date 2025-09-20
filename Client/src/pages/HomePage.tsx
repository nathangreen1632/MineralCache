// Client/src/pages/HomePage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage(): React.ReactElement {
  return (
    <section className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]">
      <h1 className="text-2xl font-extrabold mb-2">Mineral Cache</h1>
      <p className="text-[var(--theme-muted)] mb-6">
        A streamlined marketplace for minerals and vendors. Pick where to start:
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/vendor/apply"
          className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
        >
          Apply as Vendor
        </Link>
        <Link
          to="/admin/vendor-apps"
          className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          Admin · Vendor Applications
        </Link>
      </div>
    </section>
  );
}
