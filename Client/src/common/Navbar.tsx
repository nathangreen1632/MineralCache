import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Home, Store, ClipboardList, LayoutDashboard, PlusCircle } from 'lucide-react';

type LinkItem = {
  to: string;
  label: string;
  end?: boolean;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

function itemClasses(isActive: boolean): string {
  const base =
    'group inline-flex items-center gap-3 w-full rounded-xl px-3 py-2 font-semibold transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] ' +
    'border border-transparent';
  if (isActive) {
    return [
      base,
      'bg-[var(--theme-card)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-sm',
    ].join(' ');
  }
  return [
    base,
    'text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] hover:bg-[var(--theme-surface)]',
  ].join(' ');
}

function SideNavLink({ to, label, end, Icon }: Readonly<LinkItem>) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => itemClasses(isActive)}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function Navbar(): React.ReactElement {
  return (
    <aside
      className={[
        'w-64 shrink-0',
        'border-r border-[var(--theme-border)]',
        'bg-[var(--theme-surface)]',
        'sticky top-0 h-screen overflow-y-auto',
        'px-4 py-4',
      ].join(' ')}
    >
      {/* Brand */}
      <Link
        to="/"
        className="block text-xl font-extrabold tracking-tight text-[var(--theme-text)]"
        style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
      >
        Mineral Cache
      </Link>

      {/* Nav */}
      <nav className="mt-6 grid gap-1">
        <SideNavLink to="/" end label="Home" Icon={Home} />
        <SideNavLink to="/vendor/apply" label="Apply as Vendor" Icon={Store} />
        <SideNavLink to="/vendor/dashboard" label="Vendor Dashboard" Icon={LayoutDashboard} />
        <SideNavLink to="/products/new" label="New Product" Icon={PlusCircle} />
        <SideNavLink to="/admin/vendor-apps" label="Admin · Vendor Apps" Icon={ClipboardList} />
        <SideNavLink to="/products" label="Catalog" Icon={Home} />
      </nav>
    </aside>
  );
}
