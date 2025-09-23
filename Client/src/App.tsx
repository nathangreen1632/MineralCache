// Client/src/App.tsx
import React, { useEffect, useState } from 'react';
import AppRoutes from './AppRoutes';
import Navbar from './common/Navbar';
import Footer from './common/Footer';
import { Toaster } from 'react-hot-toast';
import { get, post } from './lib/api';
import GravatarStrip from './components/profile/GravatarStrip';

// --- 18+ banner mounted globally ---
function AgeGateBanner(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Expect dobVerified18 on one of these shapes; be tolerant
        const { data } = await get('/auth/me');
        const v =
          (data && (data as any).dobVerified18 === true) ||
          (data && (data as any).user?.dobVerified18 === true) ||
          (data && (data as any).me?.dobVerified18 === true);
        if (alive && !v) setVisible(true);
      } catch {
        // If unknown, show the prompt so users can self-verify
        if (alive) setVisible(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function confirm18() {
    try {
      setBusy(true);
      await post('/auth/verify-18', { confirmed: true });
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

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
          You must be 18+ to place bids or checkout. Please confirm you are at least 18 years old.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirm18}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
          >
            {busy ? 'Saving…' : 'I am 18+'}
          </button>
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

// Lightweight bootstrap: ping /auth/me to hydrate session & show a spinner meanwhile
function AuthBootstrap({ children }: Readonly<{ children: React.ReactElement }>) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await get('/auth/me'); // ignore result; just warms the session/user
      } catch {
        // no-op; we still render the app
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
