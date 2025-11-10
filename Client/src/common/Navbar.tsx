// Client/src/common/Navbar.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  LogIn,
  LogOut,
  Package,
  Settings,
  Banknote,
  ShieldCheck,
  Menu,
  X,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import ThemeToggle from './ThemeToggle';
import mcLogo from '../assets/mc_logo_256.webp';

function BrandName({ className }: Readonly<{ className?: string }>) {
  return (
    <span className={['inline-flex items-center gap-2', className || ''].join(' ')}>
      <img
        src={mcLogo}
        alt=""
        aria-hidden="true"
        className="h-7 w-7 rounded-lg"
        style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
      />
      <span>
        Mineral<span className="italic">Cache</span>
      </span>
    </span>
  );
}

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

function SideActionButton({
                            label,
                            Icon,
                            onClick,
                          }: Readonly<{ label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick} className={itemClasses(false)} aria-label={label}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

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
  }, [baseTo, location?.pathname]);

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

function NavContent(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const isAuthed = Boolean(user);
  const role = user?.role ?? 'buyer';
  const isVendor = role === 'vendor' || Number.isFinite(user?.vendorId);
  const isAdmin = role === 'admin';

  const AUCTIONS_ENABLED =
    String(import.meta.env.VITE_AUCTIONS_ENABLED || '').toLowerCase() === 'true';

  const onSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate('/', { replace: true });
    }
  };

  return (
    <nav className="mt-6 grid gap-1" aria-label="Main">
      <SideNavLink to="/" end label="Home" Icon={Home} />
      {(isVendor || isAdmin) ? (
        <SideNavLink to="/products" label="Shop" Icon={Store} />
      ) : (
        <SideNavLink to="/products" end label="Shop" Icon={Store} />
      )}
      {AUCTIONS_ENABLED && (
        <SideNavLink to="/auctions" end label="Auctions" Icon={ClipboardList} />
      )}
      {isVendor && (
        <NavGroup baseTo="/vendor/dashboard" label="Vendor Dashboard" Icon={LayoutDashboard}>
          <SideNavLink to="/vendor/products" label="Create Auction" Icon={Store} />
          <SideNavLink to="/products/new" label="New Product" Icon={PlusCircle} />
          <SideNavLink to="/vendor/orders" label="Customer Orders" Icon={Package} />
          <SideNavLink to="/vendor/payouts" label="Payouts" Icon={Banknote} />
        </NavGroup>
      )}
      {isAuthed && !isVendor && (
        <SideNavLink to="/vendor/apply" label="Apply as Vendor" Icon={UserPlus} />
      )}
      {isAdmin && (
        <NavGroup baseTo="/admin" label="Admin Dashboard" Icon={LayoutDashboard}>
          <SideNavLink to="/admin/vendor-apps" label="Vendor Applications" Icon={ClipboardList} />
          <SideNavLink to="/admin/orders" label="Orders" Icon={Package} />
          {AUCTIONS_ENABLED && (
            <SideNavLink to="/admin/auctions" label="Auctions" Icon={ShieldCheck} />
          )}
          <SideNavLink to="/admin/settings" label="Settings" Icon={Settings} />
        </NavGroup>
      )}
      <SideNavLink to="/cart" label="Cart" Icon={ShoppingCart} />
      {isAuthed && <SideNavLink to="/checkout" label="Checkout" Icon={CreditCard} />}
      {isAuthed && <SideNavLink to="/account/orders" label="My Orders" Icon={Package} />}
      <SideNavLink to="/legal" end label="Legal" Icon={FileText} />
      {!isAuthed ? (
        <>
          <SideNavLink to="/login" label="Sign in" Icon={LogIn} />
          <SideNavLink to="/register" label="Create account" Icon={UserPlus} />
        </>
      ) : (
        <SideActionButton label="Sign out" Icon={LogOut} onClick={onSignOut} />
      )}
    </nav>
  );
}

export default function Navbar(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent | TouchEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      const inPanel = panelRef.current && t && panelRef.current.contains(t);
      const inButton = buttonRef.current && t && buttonRef.current.contains(t);
      if (!inPanel && !inButton) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) panelRef.current?.focus(); }, [open]);

  const label = open ? 'Close navigation' : 'Open navigation';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="hidden max-[1025px]:inline-flex fixed top-2 left-2 z-50 items-center rounded-2xl px-3 py-2
                   bg-[var(--theme-button)] text-[var(--theme-text-white)]
                   hover:bg-[var(--theme-button-hover)]
                   focus-visible:ring-2 focus-visible:ring-offset-2
                   focus-visible:ring-[var(--theme-focus)]
                   focus-visible:ring-offset-[var(--theme-surface)]
                   shadow-[0_10px_30px_var(--theme-shadow)]"
        aria-label={label}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-2 w-2" aria-hidden="true" /> : <Menu className="h-3 w-3" aria-hidden="true" />}
      </button>

      {open && (
        <div className="hidden max-[1025px]:block fixed inset-0 z-40">
          <div
            id="mobile-nav-panel"
            ref={panelRef}
            tabIndex={-1}
            role="text"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
            className="absolute top-3 left-2 right-2 max-h-[85vh] overflow-y-auto
                       rounded-2xl border border-[var(--theme-border)]
                       bg-[var(--theme-surface)] shadow-[0_10px_30px_var(--theme-shadow)] p-4"
          >
            <div className="flex items-center justify-between">
              <Link
                id="mobile-nav-title"
                to="/"
                className="text-2xl font-extrabold tracking-tight text-[var(--theme-text)] mt-4"
                style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
                onClick={() => setOpen(false)}
                aria-label="MineralCache home"
              >
                <BrandName />
              </Link>
            </div>

            <ThemeToggle />

            <div className="mt-4 grid gap-1">
              <NavContent />
            </div>
          </div>
        </div>
      )}

      <aside
        className="hidden min-[1025px]:block w-64 shrink-0
                   border-r border-[var(--theme-border)]
                   bg-[var(--theme-surface)]
                   sticky top-0 h-screen overflow-y-auto
                   px-4 py-4"
        aria-label="Primary navigation"
      >
        <Link
          to="/"
          className="block text-3xl font-extrabold tracking-tight text-[var(--theme-text)]"
          style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
          aria-label="MineralCache home"
        >
          <BrandName />
        </Link>

        <ThemeToggle />

        <NavContent />
      </aside>
    </>
  );
}
