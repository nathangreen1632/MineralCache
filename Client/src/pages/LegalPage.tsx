// Client/src/pages/LegalPage.tsx
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

type Doc = { title: string; file: string; key: string };

const docs: Doc[] = [
  { title: 'Cookie Policy', file: 'cookie-policy.html', key: 'cookie' },
  { title: 'Copyright & IP Policy', file: 'copyright-policy.html', key: 'copyright' },
  { title: 'Data Processing Addendum', file: 'dpa-policy.html', key: 'dpa' },
  { title: 'EULA', file: 'eula.html', key: 'eula' },
  { title: 'Data Consumption & Usage', file: 'privacy-choices.html', key: 'data' },
  { title: 'Privacy Policy', file: 'privacy-policy.html', key: 'privacy' },
  { title: 'Returns & Refunds', file: 'refund-policy.html', key: 'refund' },
  { title: 'Security Policy', file: 'security-policy.html', key: 'security' },
  { title: 'Shipping Policy', file: 'shipping-policy.html', key: 'shipping' },
  { title: 'Terms of Service', file: 'terms-of-service.html', key: 'tos' },
  { title: 'Vendor Terms & Listing Standards', file: 'seller-vendor-terms-and-conditions.html', key: 'vendor' },
];

type TopBarProps = { items: Doc[]; active: string; onPick: (key: string) => void; navOpen: boolean; setNavOpen: (v: boolean) => void };
function TopBar({ items, active, onPick, navOpen, setNavOpen }: Readonly<TopBarProps>) {
  return (
    <motion.nav
      id="legalTopBar"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      aria-label="Legal navigation"
      className="sticky top-0 z-30 border-b bg-[var(--theme-bg)]/85 backdrop-blur border-[var(--theme-border)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex justify-center mb-3 md:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(!navOpen)}
            className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            aria-expanded={navOpen}
            aria-controls="legalPills"
          >
            {navOpen ? 'Hide Documents' : 'Show Documents'}
          </button>
        </div>
        <ul id="legalPills" className={`flex flex-wrap justify-center gap-3 ${navOpen ? 'flex' : 'hidden md:flex'}`} role="text">
          {items.map((d) => {
            const isActive = active === d.key;
            const base = 'px-3 py-1.5 rounded-lg text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]';
            const on = 'bg-[var(--theme-button)] text-[var(--theme-text-white)]';
            const off = 'bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-button)] hover:text-[var(--theme-text-white)]';
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
  const sorted = useMemo(() => [...docs].sort((a, b) => a.title.localeCompare(b.title)), []);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeKey, setActiveKey] = useState<string>(sorted[0]?.key ?? '');
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState<boolean>(false);
  const [barH, setBarH] = useState<number>(0);
  const [html, setHtml] = useState<Record<string, string>>({});
  const programmatic = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const PUBLIC_BASE = import.meta.env.BASE_URL || '/';
  const assetUrl = (file: string) => `${String(PUBLIC_BASE).replace(/\/$/, '')}/legal/${file}`;
  const rafId = useRef<number | null>(null);

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
    if (h && sorted.some((d) => d.key === h)) setActiveKey(h);
  }, [sorted]);

  useEffect(() => {
    Promise.allSettled(
      sorted.map((d) =>
        fetch(assetUrl(d.file), { cache: 'no-store' })
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Unable to load.'))))
          .then((t) => ({ key: d.key, html: t }))
          .catch(() => ({ key: d.key, html: '<div class="mc-legal"><p>Unable to load.</p></div>' }))
      )
    ).then((res) => {
      const next: Record<string, string> = {};
      res.forEach((x) => {
        if (x.status === 'fulfilled') next[x.value.key] = x.value.html;
      });
      setHtml(next);
    });
  }, [sorted]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    const io = new IntersectionObserver((entries) => {
      if (programmatic.current) return;
      const visible = entries.find((e) => e.isIntersecting);
      if (!visible) return;
      const key = Object.entries(sectionRefs.current).find(([_, el]) => el === visible.target)?.[0];
      if (key && key !== activeKey) {
        setActiveKey(key);
        if (typeof window !== 'undefined') history.replaceState(null, '', `#${key}`);
      }
    }, { root: null, rootMargin: `-${barH + 24}px 0px -70% 0px`, threshold: 0.2 });
    observerRef.current = io;
    Object.values(sectionRefs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [sorted, barH, activeKey]);

  useEffect(() => {
    const onScroll = () => {
      if (programmatic.current) return;
      if (rafId.current !== null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        const y = window.scrollY + barH + 24;
        let current = sorted[0]?.key ?? '';
        for (const d of sorted) {
          const el = sectionRefs.current[d.key];
          if (el && el.offsetTop <= y) current = d.key;
        }
        if (current && current !== activeKey) {
          setActiveKey(current);
          if (typeof window !== 'undefined') history.replaceState(null, '', `#${current}`);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [sorted, barH, activeKey]);

  const handleScrollTo = (key: string) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    setActiveKey(key);
    setHighlighted(key);
    setTimeout(() => setHighlighted(null), 1600);
    const y = el.getBoundingClientRect().top + window.scrollY - barH - 16;
    const distance = Math.abs(window.scrollY - y);
    const guardMs = Math.max(500, Math.min(1600, Math.round(distance * 0.6)));
    programmatic.current = true;
    window.scrollTo({ top: y, behavior: 'smooth' });
    if (typeof window !== 'undefined') history.replaceState(null, '', `#${key}`);
    setNavOpen(false);
    window.setTimeout(() => {
      programmatic.current = false;
      setActiveKey(key);
    }, guardMs);
  };


  const scrollToTop = () => {
    const first = sorted[0]?.key ?? '';
    const distance = Math.abs(window.scrollY);
    const guardMs = Math.max(500, Math.min(1600, Math.round(distance * 0.6)));
    programmatic.current = true;
    if (first) {
      setActiveKey(first);
      if (typeof window !== 'undefined') history.replaceState(null, '', `#${first}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => {
      programmatic.current = false;
      if (first) setActiveKey(first);
    }, guardMs);
  };


  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]" style={{ overflowAnchor: 'none' as any }}>
      <TopBar items={sorted} active={activeKey} onPick={handleScrollTo} navOpen={navOpen} setNavOpen={setNavOpen} />
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10">
        <h1 className="text-3xl font-bold">Legal Documents</h1>
        {sorted.map((doc) => (
          <section
            key={doc.key}
            id={doc.key}
            ref={(el) => { sectionRefs.current[doc.key] = el; }}
            style={{ scrollMarginTop: barH + 16 }}
            className={`rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-[0_10px_30px_var(--theme-shadow)] ${highlighted === doc.key ? 'ring-2 ring-[var(--theme-focus)]' : ''}`}
            aria-labelledby={`heading-${doc.key}`}
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 id={`heading-${doc.key}`} className="text-2xl font-semibold">{doc.title}</h2>
              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
                aria-label="Back to top"
              >
                Back to Top
              </button>
            </div>
            <div
              className="prose max-w-none prose-invert [&_*]:text-[var(--theme-text)] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-[var(--theme-border)] [&_td]:border-[var(--theme-border)] [&_thead_th]:bg-[var(--theme-card)]"
              dangerouslySetInnerHTML={{ __html: html[doc.key] ?? '' }}
            />
            {activeKey === doc.key && !html[doc.key] && <div className="mt-4 text-sm opacity-80">Loading…</div>}
          </section>
        ))}
      </div>
    </div>
  );
}
