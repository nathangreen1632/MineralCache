// Client/src/App.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import Navbar from './common/Navbar';
import Footer from './common/Footer';
import { Toaster } from 'react-hot-toast';
import GravatarStrip from './components/profile/GravatarStrip';
import { useAuthStore } from './stores/useAuthStore';

// --- 18+ banner mounted globally ---
function AgeGateBanner(): React.ReactElement | null {
  const user = useAuthStore((s) => s.user);
  if (!user || user.dobVerified18) return null;

  return (
    <div
      className="mx-auto w-full"
      style={{
        background: 'var(--theme-card)',
        borderBottom: '1px solid var(--theme-border)',
        color: 'var(--theme-text)',
      }}
      role="text"
      aria-label="Age verification"
    >
      <div className="mx-auto max-w-7xl 2xl:max-w-[80rem] px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm">
          You must be 18+ to place bids or checkout. Please verify your age to continue.
        </p>
        <div className="flex gap-2">
          <Link
            to="/verify-age"
            className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
          >
            Verify age
          </Link>
          <a
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset"
            style={{
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }}
          >
            Continue browsing
          </a>
        </div>
      </div>
    </div>
  );
}

// Lightweight bootstrap: hydrate auth store on app load & show a spinner meanwhile
function AuthBootstrap({ children }: Readonly<{ children: React.ReactElement }>) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // ✅ hydrate session on first paint (robust to /auth/me response shape)
        await useAuthStore.getState().me();
      } catch {
        // no-op; still render the app
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] flex">
        <Navbar />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div
              className={[
                'rounded-2xl border border-[var(--theme-border)]',
                'bg-[var(--theme-surface)] shadow-sm px-6 py-5',
                'text-[var(--theme-text)]',
              ].join(' ')}
              aria-busy="true"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    'inline-block h-5 w-5 rounded-full border-2',
                    'border-[var(--theme-border)] border-t-[var(--theme-button-hover)]',
                    'animate-spin',
                  ].join(' ')}
                />
                <span className="font-semibold">Loading…</span>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  return children;
}

export default function App(): React.ReactElement {
  // Container width (adjust per-route if you want)
  const mainWidth = 'max-w-7xl 2xl:max-w-[80rem]';

  return (
    <AuthBootstrap>
      <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] flex">
        {/* Left sidebar (always visible) */}
        <Navbar />

        {/* Right side: content column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Optional top strip (user/gravatar) */}
          <GravatarStrip />

          {/* Global 18+ banner */}
          <AgeGateBanner />

          <main className={['flex-grow w-full mx-auto', mainWidth, 'px-4'].join(' ')}>
            <AppRoutes />
          </main>

          <Footer />

          <Toaster
            toastOptions={{
              position: 'top-center',
              duration: 3000,
              style: {
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-border)',
              },
            }}
          />
        </div>
      </div>
    </AuthBootstrap>
  );
}
