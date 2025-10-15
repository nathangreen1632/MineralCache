import React, { useEffect, useMemo, useState } from 'react';
import { getRequiredLegal, type LegalDoc } from '../api/legal';
import { loadLegalHtml } from '../utils/loadLegalHtml';

export default function LegalPage(): React.ReactElement {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const map = useMemo(() => new Map(docs.map((d) => [d.key, d])), [docs]);

  useEffect(() => {
    getRequiredLegal().then(setDocs).catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    const fromHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (fromHash) setActive(fromHash);
  }, [docs.length]);

  useEffect(() => {
    const k = active ?? docs[0]?.key ?? null;
    if (!k) return;
    const d = map.get(k);
    if (!d) return;
    loadLegalHtml(d.file).then(setHtml).catch(() => setHtml('<p>Unable to load.</p>'));
  }, [active, docs, map]);

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-5xl px-6 py-14 grid gap-10 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4">
          <nav className="grid gap-2">
            {docs.map((d) => (
              <button
                key={d.key}
                onClick={() => {
                  setActive(d.key);
                  if (typeof window !== 'undefined') window.location.hash = d.key;
                }}
                className="text-left underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
                aria-current={active === d.key ? 'page' : undefined}
              >
                {d.title}
              </button>
            ))}
          </nav>
        </aside>
        <main className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </main>
      </div>
    </div>
  );
}
