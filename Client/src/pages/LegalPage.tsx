import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

type Doc = { title: string; file: string; key: string };

const docs: Doc[] = [
  { title: 'AI Fair Use Policy', file: 'ai-fair-use-policy.html', key: 'ai' },
  { title: 'Cookie Policy', file: 'cookie-policy.html', key: 'cookie' },
  { title: 'Copyright & IP Policy', file: 'copyright-policy.html', key: 'copyright' },
  { title: 'Data Processing Addendum', file: 'dpa-policy.html', key: 'dpa' },
  { title: 'Disclaimer', file: 'disclaimer-policy.html', key: 'disclaimer' },
  { title: 'End User License Agreement', file: 'eula.html', key: 'eula' },
  { title: 'GDPR Representative Agreement', file: 'gdpr.html', key: 'gdpr' },
  { title: 'Privacy Policy', file: 'privacy-policy.html', key: 'privacy' },
  { title: 'Security Policy', file: 'security-policy.html', key: 'security' },
  { title: 'Terms of Service', file: 'terms-of-service.html', key: 'tos' },
];

type BackToTopProps = { onClick: () => void };
function BackToTop({ onClick }: Readonly<BackToTopProps>): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
      aria-label="Back to top"
    >
      Back to Top
    </button>
  );
}

type TopLinkBarProps = { docs: Doc[]; active: string; onPick: (key: string) => void };
function TopLinkBar({ docs, active, onPick }: Readonly<TopLinkBarProps>): React.ReactElement {
  return (
    <motion.nav
      id="legalTopBar"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      aria-label="Legal navigation"
      className="sticky top-0 z-30 border-b border-[var(--theme-border)] bg-[var(--theme-bg)]/85 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl 2xl:max-w-[80rem] px-6 py-4">
        <ul className="flex flex-wrap gap-3 justify-center">
          {docs.map((d) => {
            const isActive = active === d.key;
            const base =
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]';
            const on = 'bg-[var(--theme-button)] text-[var(--theme-text-white)]';
            const off =
              'bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-button)] hover:text-[var(--theme-text-white)]';
            return (
              <li key={d.key}>
                <button
                  type="button"
                  onClick={() => onPick(d.key)}
                  className={`${base} ${isActive ? on : off}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {d.title}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.nav>
  );
}

export default function LegalPage(): React.ReactElement {
  const sortedDocs = useMemo(() => [...docs].sort((a, b) => a.title.localeCompare(b.title)), []);
  const [active, setActive] = useState<string>(sortedDocs[0]?.key ?? '');
  const [html, setHtml] = useState<Record<string, string>>({});
  const [barH, setBarH] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const map = useMemo(() => {
    const m: Record<string, Doc> = {};
    sortedDocs.forEach((d) => (m[d.key] = d));
    return m;
  }, [sortedDocs]);

  useEffect(() => {
    const nav = document.getElementById('legalTopBar');
    if (!nav) return;
    const measure = () => setBarH(nav.getBoundingClientRect().height || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const h = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (h && map[h]) setActive(h);
  }, [map]);

  useEffect(() => {
    const targets = sortedDocs.map((d) => d.key);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    targets.forEach((k) => {
      const el = sectionRefs.current[k];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sortedDocs]);

  useEffect(() => {
    const d = map[active];
    if (!d) return;
    const url = `/legal/${d.file}`;
    if (html[d.key]) return;
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => setHtml((s) => ({ ...s, [d.key]: t })))
      .catch(() => setHtml((s) => ({ ...s, [d.key]: '<p>Unable to load.</p>' })));
  }, [active, map, html]);

  const scrollTo = (key: string) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - barH - 16;
    window.scrollTo({ top: y, behavior: 'smooth' });
    if (typeof window !== 'undefined') history.replaceState(null, '', `#${key}`);
  };

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <TopLinkBar docs={sortedDocs} active={active} onPick={scrollTo} />
      <div className="mx-auto max-w-7xl 2xl:max-w-[80rem] px-6 pt-6 pb-14 space-y-10">
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.05 }}
          className="space-y-10"
        >
          {sortedDocs.map((d) => (
            <section
              key={d.key}
              id={d.key}
              ref={(el) => {
                sectionRefs.current[d.key] = el;
              }}
              style={{ scrollMarginTop: barH + 16 }}
              className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)]"
              aria-labelledby={`heading-${d.key}`}
            >
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 id={`heading-${d.key}`} className="text-2xl font-semibold">
                  {d.title}
                </h2>
                <BackToTop onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
              </div>
              <div
                className="prose max-w-none prose-invert [&_*]:text-[var(--theme-text)]"
                dangerouslySetInnerHTML={{ __html: html[d.key] ?? '' }}
              />
              {!html[d.key] && <div className="mt-4 text-sm opacity-80">Loading…</div>}
            </section>
          ))}
        </motion.main>
      </div>
    </div>
  );
}
