import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadLegalHtml } from '../../utils/loadLegalHtml';
import type { LegalDoc } from '../../api/legal';

type Accepted = { documentType: string; version: string };

type Props = {
  open: boolean;
  docs: LegalDoc[];
  onClose: () => void;
  onComplete: (accepted: Accepted[]) => void;
  title?: string;
};

export default function LegalAgreementModal(props: Readonly<Props>): React.ReactElement | null {
  const { open, docs, onClose, onComplete, title } = props;
  const [idx, setIdx] = useState(0);
  const [html, setHtml] = useState<string>('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<Accepted[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const agreeId = useMemo(() => `agree-${docs[idx]?.key ?? 'x'}`, [idx, docs]);

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    setAccepted([]);
    setChecked({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const d = docs[idx];
    if (!d) return;
    loadLegalHtml(d.file).then(setHtml).catch(() => setHtml('<p>Unable to load.</p>'));
  }, [open, idx, docs]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    if (first) first.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = Array.from(focusables).filter((n) => !n.hasAttribute('disabled'));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = docs[idx];
  const canNext = Boolean(checked[current?.key ?? '']);
  const atEnd = idx === docs.length - 1;

  function onAgreeCurrent() {
    const d = docs[idx];
    if (!d) return;
    setAccepted((a) => {
      const exists = a.some((x) => x.documentType === d.key && x.version === d.version);
      if (exists) return a;
      return [...a, { documentType: d.key, version: d.version }];
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="text"
      aria-modal="true"
      aria-labelledby="legal-title"
      aria-describedby="legal-desc"
    >
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-3xl rounded-2xl border bg-[var(--theme-surface)] border-[var(--theme-border)] p-6 shadow-2xl focus:outline-none"
      >
        <div className="mb-4">
          <h2 id="legal-title" className="text-xl font-semibold text-[var(--theme-text)]">
            {title ?? 'Please review and accept'}
          </h2>
          <p id="legal-desc" className="text-sm text-[var(--theme-text)] opacity-70">
            {current?.title ?? ''}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 max-h-[50vh] overflow-auto text-[var(--theme-text)]">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex items-start gap-3 text-[var(--theme-text)]">
            <input
              id={agreeId}
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={Boolean(checked[current?.key ?? ''])}
              onChange={(e) => {
                const val = e.target.checked;
                const k = current?.key ?? '';
                setChecked((c) => ({ ...c, [k]: val }));
              }}
            />
            <span className="select-none">I have read and agree to the {current?.title ?? ''}</span>
          </label>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)]"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={idx === 0}
                aria-disabled={idx === 0}
                onClick={() => setIdx((n) => (n > 0 ? n - 1 : n))}
                className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
              >
                Back
              </button>

              {!atEnd && (
                <button
                  type="button"
                  disabled={!canNext}
                  aria-disabled={!canNext}
                  onClick={() => {
                    if (!canNext) return;
                    onAgreeCurrent();
                    setIdx((n) => (n < docs.length - 1 ? n + 1 : n));
                  }}
                  className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
                >
                  Next
                </button>
              )}

              {atEnd && (
                <button
                  type="button"
                  disabled={!canNext}
                  aria-disabled={!canNext}
                  onClick={() => {
                    if (!canNext) return;
                    onAgreeCurrent();
                    onComplete(accepted.length > 0 ? accepted : [{ documentType: current.key, version: current.version }]);
                    onClose();
                  }}
                  className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--theme-button)] text-[var(--theme-text-white)] hover:bg-[var(--theme-button-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] disabled:opacity-50"
                >
                  Accept & Continue
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-[var(--theme-text)] opacity-70">
            {idx + 1} of {docs.length}
          </div>
        </div>
      </div>
    </div>
  );
}
