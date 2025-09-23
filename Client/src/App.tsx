// Client/src/App.tsx
import React, { useEffect, useState } from 'react';
import AppRoutes from './AppRoutes';
import Navbar from './common/Navbar';
import Footer from './common/Footer';
import { Toaster } from 'react-hot-toast';
import { get } from './lib/api';
import GravatarStrip from './components/profile/GravatarStrip';

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
