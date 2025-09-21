// Client/src/App.tsx
import React from 'react';
import AppRoutes from './AppRoutes';
import Navbar from './common/Navbar';

export default function App(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)]">
      {/* Global navbar (renders on every page) */}
      <Navbar />

      {/* Page content area */}
      <main className="mx-auto max-w-3xl px-6 py-14 grid gap-10">
        <AppRoutes />
      </main>
    </div>
  );
}
