// Client/src/App.tsx
import React, { useEffect, useState } from 'react';
import AppRoutes from './AppRoutes';
import Navbar from './common/Navbar';
import Footer from './common/Footer';
import { Toaster } from 'react-hot-toast';
import { get } from './lib/api';
import GravatarStrip from "./components/profile/GravatarStrip.tsx";

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
      <div className="min-h-screen flex flex-col bg-[var(--theme-bg)]">
        <Navbar />
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
    );
  }

  return children;
}

export default function App(): React.ReactElement {

  // Match FridayBibleStudy’s responsive container widths.
  // Tweak or add special-cases if you want wider admin pages later.
  let mainWidth = 'max-w-7xl 2xl:max-w-[80rem]';
  // Example of widening a specific admin area if desired:
  // if (loc.pathname.startsWith('/admin/vendor-apps')) {
  //   mainWidth = 'max-w-[88rem] 2xl:max-w-[96rem]';
  // }

  return (
    <AuthBootstrap>
      <div className="min-h-screen flex flex-col bg-[var(--theme-bg)]">
        <Navbar />
        <GravatarStrip />

        {/* If you later add a strip/banner like Friday’s GravatarStrip, drop it here */}

        <main className={['flex-grow w-full mx-auto', mainWidth].join(' ')}>
          <AppRoutes />
        </main>

        <Footer />
        <Toaster
          toastOptions={{
            style: {
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-border)',
            },
          }}
        />
      </div>
    </AuthBootstrap>
  );
}
