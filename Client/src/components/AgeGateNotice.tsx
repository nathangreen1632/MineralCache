// Client/src/components/AgeGateNotice.tsx
import React, { useEffect, useState } from 'react';
import { getMe, verify18 } from '../api/auth';

type GateState =
  | { kind: 'hidden' } // not logged in or already verified, or user dismissed
  | { kind: 'show' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string };

const DISMISS_KEY = 'agegate:dismissed';

export default function AgeGateNotice(): React.ReactElement | null {
  const [state, setState] = useState<GateState>({ kind: 'hidden' });

  useEffect(() => {
    // Don’t show again if the user temporarily dismissed during this browser session
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    let alive = true;
    (async () => {
      const { data } = await getMe();
      if (!alive) return;
      const u = data?.user ?? null;
      if (u && !u.dobVerified18) setState({ kind: 'show' });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === 'hidden') return null;

  async function handleConfirm() {
    setState({ kind: 'busy' });
    const { data, error } = await verify18();
    if (error || !data?.ok) {
      setState({ kind: 'error', message: error || 'Failed to verify age.' });
      return;
    }
    setState({ kind: 'hidden' }); // hide after success
  }

  function handleDismiss() {
    // Soft-dismiss for this session only. Server still enforces requireAdult where needed.
    sessionStorage.setItem(DISMISS_KEY, '1');
    setState({ kind: 'hidden' });
  }

  const isBusy = state.kind === 'busy';
  const isError = state.kind === 'error';

  return (
    <div
      role="text"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50"
      style={{ filter: 'drop-shadow(0 -8px 24px var(--theme-shadow))' }}
    >
      <div
        className="mx-auto max-w-5xl rounded-t-2xl border px-4 py-3 sm:px-5 sm:py-4"
        style={{
          background: 'var(--theme-card)',
          color: 'var(--theme-text)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            This marketplace offers minerals for adult collectors. Please confirm you’re 18 or older.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isBusy}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
              style={{
                background: 'var(--theme-button)',
                color: 'var(--theme-text-white)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-button-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-button)')}
            >
              {isBusy ? 'Saving…' : "I'm 18+"}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset"
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                borderColor: 'var(--theme-border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-surface)')}
            >
              Not now
            </button>
          </div>
        </div>

        {isError && (
          <p className="mt-2 text-xs" style={{ color: 'var(--theme-error)' }}>
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
