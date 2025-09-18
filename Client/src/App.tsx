// src/App.tsx
import React, { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './index.css';

export default function App(): React.ReactElement {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
        {/* Header: logos + title */}
        <header className="flex items-center justify-center gap-6">
          <a href="https://vite.dev" target="_blank" rel="noreferrer" className="group">
            <img
              src={viteLogo}
              alt="Vite"
              className="h-14 w-14 transition-transform duration-200 group-hover:scale-105"
              style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
            />
          </a>

          <h1 className="text-3xl font-extrabold tracking-tight">
            Vite + React
          </h1>

          <a href="https://react.dev" target="_blank" rel="noreferrer" className="group">
            <img
              src={reactLogo}
              alt="React"
              className="h-14 w-14 transition-transform duration-200 group-hover:scale-105"
              style={{ filter: 'drop-shadow(0 6px 18px var(--theme-shadow))' }}
            />
          </a>
        </header>

        {/* Card */}
        <section
          className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-sm"
          style={{ boxShadow: '0 10px 30px var(--theme-shadow)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Starter Card</h2>
            <nav className="flex items-center gap-4 text-sm">
              <a
                href="https://vite.dev"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] transition-colors"
              >
                Vite docs
              </a>
              <a
                href="https://react.dev"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] transition-colors"
              >
                React docs
              </a>
            </nav>
          </div>

          <p className="mt-2 text-sm opacity-80">
            Edit{' '}
            <code className="rounded px-2 py-0.5 border bg-[var(--theme-card)] border-[var(--theme-border)]">
              src/App.tsx
            </code>{' '}
            and save to test HMR
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setCount((c) => c + 1)}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold
                         bg-[var(--theme-button)] text-[var(--theme-text-white)]
                         hover:bg-[var(--theme-button-hover)]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]
                         transition-colors"
            >
              count is {count}
            </button>
          </div>
        </section>

        {/* Footer note */}
        <p className="text-center text-sm opacity-70">
          Click on the Vite and React logos to learn more
        </p>
      </div>
    </main>
  );
}
