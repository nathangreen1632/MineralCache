import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCategories, type PublicCategory } from '../../api/public';

const VISIBLE = 8;
const ROTATE_MS = 5000;

const SKELETON_KEYS = Object.freeze([
  'sk-a','sk-b','sk-c','sk-d','sk-e','sk-f','sk-g','sk-h'
]);

function getWindow<T>(arr: T[], start: number, size: number): T[] {
  const out: T[] = [];
  const n = arr.length;
  if (n === 0) return out;
  for (let i = 0; i < Math.min(size, n); i += 1) {
    const idx = (start + i) % n;
    out.push(arr[idx]);
  }
  return out;
}

function categoryImgUrl(cat: PublicCategory): string {
  // Place static images in: Client/public/categories/<slug>.jpg (or use imageKey)
  if (cat.imageKey && cat.imageKey.trim().length > 0) return `/categories/${cat.imageKey}`;
  return `/categories/${cat.slug}.jpg`;
}

export default function CategoriesRow(): React.ReactElement {
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    async function load() {
      try {
        const rows = await listCategories();
        setCats(rows);
      } catch {
        setErr('Unable to load categories');
      }
    }
    void load();
  }, []);

  // Auto-rotate
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    const shouldRotate = !paused && !prefersReduced && cats.length > VISIBLE;
    if (!shouldRotate) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return () => {};
    }
    intervalRef.current = window.setInterval(() => {
      setStart((s) => (s + VISIBLE) % cats.length);
    }, ROTATE_MS);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [paused, prefersReduced, cats.length]);

  const visible = useMemo(() => getWindow(cats, start, VISIBLE), [cats, start]);

  if (err) {
    return (
      <section aria-label="Browse by category" className="mx-auto max-w-5xl px-6">
        <p className="text-[var(--theme-text)]">{err}</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Browse by category"
      className="mx-auto max-w-8xl px-6 mt-8"
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          className="
            text-4xl font-extrabold
            bg-gradient-to-r
            from-[var(--theme-button-yellow)]
            to-[var(--theme-card-number)]
            bg-clip-text
            text-transparent
          "
        >
          Categories
        </h2>

        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="hidden md:inline-flex rounded-xl px-4 py-2 bg-[var(--theme-button)] text-[var(--theme-text-white)] text-xs font-bold hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>

      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {visible.length === 0 &&
          SKELETON_KEYS.map((k) => (
            <li
              key={k}
              className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-4"
            >
              <div className="aspect-square rounded-xl bg-[var(--theme-card)] animate-pulse" />
              <div className="h-4 mt-3 rounded bg-[var(--theme-card)] animate-pulse" />
            </li>
          ))
        }

        {visible.map((cat) => (
          <li key={cat.id} className="rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] shadow-[0_4px_10px_var(--theme-shadow-carousel)] p-3">
            <Link
              to={`/category/${cat.slug}`}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] rounded-xl"
              aria-label={`Browse ${cat.name}`}
            >
              <div className="aspect-square rounded-xl bg-black/90 overflow-hidden flex items-center justify-center">
                <img
                  src={categoryImgUrl(cat)}
                  alt={cat.name}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="mt-2 text-lg text-center font-semibold text-[var(--theme-text)]">
                {cat.name}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
