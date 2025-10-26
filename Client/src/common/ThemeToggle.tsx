// Client/src/common/ThemeToggle.tsx
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle(): React.ReactElement {
  const { isDark, toggle, pref, setSystem } = useTheme();

  let appearanceText: 'System' | 'Dark' | 'Light';
  if (pref === 'system') {
    appearanceText = 'System';
  } else if (isDark) {
    appearanceText = 'Dark';
  } else {
    appearanceText = 'Light';
  }

  return (
    <div className="mt-4 mb-2 grid gap-2" aria-label="Appearance">
      <div className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--theme-text)]">
          <span>Appearance</span>
          <span className="ml-2 rounded-md px-2 py-0.5 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)]">
            {appearanceText}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label="Toggle dark mode"
          onClick={toggle}
          className="relative inline-flex h-8 w-16 items-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-surface)]"
        >
          <span
            className={`absolute inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--theme-button)] text-[var(--theme-text-white)] shadow-[0_10px_30px_var(--theme-shadow)] transition-transform ${isDark ? 'translate-x-8' : 'translate-x-1'}`}
          >
            {isDark ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
          </span>
        </button>
      </div>
      {pref !== 'system' && (
        <button
          type="button"
          onClick={setSystem}
          className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-link)] hover:text-[var(--theme-link-hover)]"
        >
          Use system preference
        </button>
      )}
    </div>
  );
}
