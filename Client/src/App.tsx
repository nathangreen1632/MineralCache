import React from 'react';
import { Outlet } from 'react-router-dom';

export default function App(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <header className="border-b border-[var(--theme-border)] bg-[var(--theme-surface)]">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
          <div className="text-xl font-extrabold tracking-tight" style={{filter:'drop-shadow(0 6px 18px var(--theme-shadow))'}}>
            Mineral Syndicate
          </div>
          <nav className="ml-auto text-sm">
            <a className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]" href="/">Home</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
        <Outlet />
      </main>
    </div>
  );
}
