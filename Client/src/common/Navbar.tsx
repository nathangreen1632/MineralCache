// Client/src/common/Navbar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base =
    'px-3 py-2 rounded-md text-sm font-medium transition-colors underline decoration-dotted';
  const active = 'text-[var(--theme-link-hover)]';
  const idle = 'text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]';
  return `${base} ${isActive ? active : idle}`;
}

export default function Navbar(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click (mobile menu)
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <header className="border-b border-[var(--theme-border)] bg-[var(--theme-surface)]">
      <div className="mx-auto w-full px-4 py-3 flex items-center gap-3 min-[1440px]:px-6">
        {/* Brand */}
        <Link
          to="/"
          className="text-lg font-extrabold tracking-tight text-[var(--theme-text)]"
          style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
          onClick={() => setOpen(false)}
        >
          Mineral Cache
        </Link>

        {/* Desktop nav (≥1440px) */}
        <nav className="hidden min-[1440px]:flex ml-auto items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/vendor/apply" className={navLinkClass}>
            Apply as Vendor
          </NavLink>
          <NavLink to="/admin/vendor-apps" className={navLinkClass}>
            Admin · Vendor Apps
          </NavLink>
        </nav>

        {/* Mobile hamburger (<1440px) */}
        <button
          type="button"
          className="min-[1440px]:hidden ml-auto inline-flex items-center justify-center rounded-xl border border-[var(--theme-border)] px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
          aria-controls="mobile-nav"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
          <span className="sr-only">Toggle navigation</span>
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <div
          ref={panelRef}
          id="mobile-nav"
          className="min-[1440px]:hidden border-t border-[var(--theme-border)] bg-[var(--theme-surface)]"
        >
          <nav className="mx-auto w-full px-4 py-3 flex flex-col gap-1">
            <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/vendor/apply" className={navLinkClass} onClick={() => setOpen(false)}>
              Apply as Vendor
            </NavLink>
            <NavLink to="/admin/vendor-apps" className={navLinkClass} onClick={() => setOpen(false)}>
              Admin · Vendor Apps
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
