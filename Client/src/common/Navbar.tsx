// Client/src/components/Navbar.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Store,
  ClipboardList,
  LayoutDashboard,
  PlusCircle,
  ShoppingCart,
  CreditCard,
  UserPlus,
  ChevronDown,
  LogIn, // ✅ added
  Package, // ✅ My Orders icon
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore'; // ✅ added

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

/** Collapsible group with a header that links to baseTo and expands when on that section */
function NavGroup({
                    baseTo,
                    label,
                    Icon,
                    children,
                  }: Readonly<{
  baseTo: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}>) {
  const location = useLocation();
  const onSection = useMemo(() => {
    if (!location?.pathname) return false;
    if (location.pathname === baseTo) return true;
    return location.pathname.startsWith(baseTo + '/');
  }, [location, baseTo]);

  const [open, setOpen] = useState(onSection);
  useEffect(() => {
    if (onSection) setOpen(true);
  }, [onSection]);

  let chevronCls = 'ml-auto h-4 w-4 transition-transform opacity-80';
  if (open) chevronCls += ' rotate-180';

  return (
    <div>
      <div className="flex items-center">
        <NavLink to={baseTo} end className={({ isActive }) => itemClasses(isActive)}>
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </NavLink>
        <button
          type="button"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen((v) => !v)}
          className="ml-2 inline-flex items-center rounded-lg px-2 py-2 hover:bg-[var(--theme-surface)]"
        >
          <ChevronDown className={chevronCls} />
        </button>
      </div>
      {open && <div className="mt-1 ml-8 grid gap-1">{children}</div>}
    </div>
  );
}

export default function Navbar(): React.ReactElement {
  const user = useAuthStore((s) => s.user); // ✅ read auth state

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

        {/* Catalog group with nested New Product */}
        <NavGroup baseTo="/products" label="Catalog" Icon={Store}>
          <SideNavLink to="/products/new" label="New Product" Icon={PlusCircle} />
        </NavGroup>

        <SideNavLink to="/vendor/dashboard" label="Vendor Dashboard" Icon={LayoutDashboard} />
        <SideNavLink to="/vendor/apply" label="Apply as Vendor" Icon={UserPlus} />
        <SideNavLink to="/admin/vendor-apps" label="Admin · Vendor Apps" Icon={ClipboardList} />

        {/* Cart & Checkout */}
        <SideNavLink to="/cart" label="Cart" Icon={ShoppingCart} />
        <SideNavLink to="/checkout" label="Checkout" Icon={CreditCard} />

        {/* Account */}
         <SideNavLink to="/account/orders" label="My Orders" Icon={Package} />

        {/* ✅ Auth: show Sign in when no user is present */}
        {!user && <SideNavLink to="/login" label="Sign in" Icon={LogIn} />}
      </nav>
    </aside>
  );
}
