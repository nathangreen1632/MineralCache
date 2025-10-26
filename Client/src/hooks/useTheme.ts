// Client/src/hooks/useTheme.ts
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'mc:theme';

function getStoredPref(): ThemePref {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (raw === 'light' || raw === 'dark') return raw;
  return 'system';
}

function setStoredPref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
}

function apply(pref: ThemePref) {
  const el = document.documentElement;
  if (pref === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', pref);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => getStoredPref());
  const media = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), []);
  const [systemDark, setSystemDark] = useState<boolean>(() => media.matches);

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [media]);

  useEffect(() => {
    apply(pref);
    setStoredPref(pref);
  }, [pref]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPref(getStoredPref());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isDark = pref === 'system' ? systemDark : pref === 'dark';

  const toggle = useCallback(() => {
    if (pref === 'system') {
      setPref(systemDark ? 'light' : 'dark');
      return;
    }
    setPref(pref === 'dark' ? 'light' : 'dark');
  }, [pref, systemDark]);

  const setSystem = useCallback(() => setPref('system'), []);

  return { pref, isDark, toggle, setSystem };
}
