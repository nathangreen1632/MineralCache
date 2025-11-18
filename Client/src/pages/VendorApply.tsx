// Client/src/pages/VendorApply.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { z } from 'zod';
import { applyVendor, getMyVendorFull } from '../api/vendor';
import { useAuthStore } from '../stores/useAuthStore';

const ApplySchema = z.object({
  displayName: z.string().min(2, 'Please enter at least 2 characters.').max(120, 'Max 120 chars.'),
  bio: z
    .string()
    .max(5000, 'Max 5000 chars.')
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null)),
  logoUrl: z
    .string()
    .max(500, 'URL too long.')
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null))
    .refine((v) => v == null || z.url().safeParse(v).success, { message: 'Invalid URL.' }),
  country: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null))
    .refine((v) => v == null || v.length === 2, { message: 'Use an ISO 2-letter code.' }),
});

type FormData = z.infer<typeof ApplySchema>;

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitted'; vendorId: number; status: 'pending' | 'approved' | 'rejected' }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string> };

type ExistingVendor =
  | {
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason: string | null;
}
  | null;

function fieldClass(invalid?: boolean): string {
  const base =
    'w-full rounded-lg border bg-[var(--theme-textbox)] px-3 py-2 text-sm outline-none ring-0';
  if (invalid) return `${base} border-[var(--theme-error)]`;
  return `${base} border-[var(--theme-border)] focus:border-[var(--theme-focus)]`;
}

export default function VendorApply(): React.ReactElement {
  const [form, setForm] = useState<FormData>({
    displayName: '',
    bio: '',
    logoUrl: '',
    country: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [existingVendor, setExistingVendor] = useState<ExistingVendor>(null);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const me = useAuthStore((s) => s.me);
  const user = useAuthStore((s) => s.user);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    const next = { ...form, [key]: value };
    setForm(next);

    const parsed = ApplySchema.safeParse(next);
    if (parsed.success) {
      setErrors({});
      return;
    }
    const fieldErrs: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === 'string' && !fieldErrs[path]) fieldErrs[path] = issue.message;
    }
    setErrors(fieldErrs);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = ApplySchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const p = issue.path[0];
        if (typeof p === 'string' && !fieldErrs[p]) fieldErrs[p] = issue.message;
      }
      setErrors(fieldErrs);
      return;
    }

    setState({ kind: 'submitting' });
    try {
      const result = await applyVendor(parsed.data);

      if ((result as any).ok === false) {
        const fe: Record<string, string> = {};
        if ((result as any).code === 'SLUG_TAKEN') {
          fe.displayName =
            (result as any).message || 'That URL is taken. Try a different display name.';
        } else if ((result as any).code === 'DISPLAY_NAME_TAKEN') {
          fe.displayName = (result as any).message || 'That display name is taken.';
        }
        setErrors(fe);
        setState({
          kind: 'error',
          message:
            (result as any).message ||
            (result as any).error ||
            'Could not submit application.',
          fieldErrors: fe,
        });
        return;
      }

      if ((result as any).ok === true) {
        setErrors({});
        setState({
          kind: 'submitted',
          vendorId: (result as any).vendorId,
          status: (result as any).status,
        });
        return;
      }

      setState({ kind: 'error', message: 'Unexpected response.' });
    } catch (err: any) {
      const msg = err?.detail?.error || err?.message || 'Failed to submit';
      setState({ kind: 'error', message: String(msg) });
    }
  }

  const checkStatusNow = useCallback(async () => {
    try {
      const res = await getMyVendorFull();
      const payload = (res as any)?.data ?? res;
      const vendor = (payload)?.vendor ?? null;
      if (vendor?.approvalStatus === 'approved') {
        await me();
        window.location.href = '/vendor/dashboard';
      }
    } catch {
    }
  }, [me]);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingVendor() {
      try {
        const res = await getMyVendorFull();
        const payload = (res as any)?.data ?? res;
        const vendor = (payload)?.vendor ?? null;
        if (!vendor || cancelled) return;
        setExistingVendor({
          status: vendor.approvalStatus,
          rejectedReason: vendor.rejectedReason ?? null,
        });
      } catch {
        if (!cancelled) setExistingVendor(null);
      }
    }

    void loadExistingVendor();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.kind !== 'submitted') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function loop() {
      await checkStatusNow();
      if (!cancelled) {
        timer = setTimeout(loop, 5000);
      }
    }

    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state.kind, checkStatusNow]);

  const submitted = state.kind === 'submitted';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-4xl font-semibold text-[var(--theme-text)]">
        Vendor application
      </h1>

      <div
        className="mb-4 rounded-md border p-3"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card-alt)' }}
      >
        <p className="text-sm" style={{ color: 'var(--theme-text)' }}>
          Account email:{' '}
          <span className="font-mono break-all text-[var(--theme-link)]">
            {user?.email ?? 'Unknown'}
          </span>
        </p>
      </div>

      {existingVendor?.status === 'rejected' && !submitted && (
        <div
          className="mb-4 rounded-md border p-3"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card-alt)' }}
        >
          <p className="text-sm" style={{ color: 'var(--theme-psycho)' }}>
            Your previous vendor application was <strong>rejected</strong>.
            {existingVendor.rejectedReason ? (
              <>
                {' '}Reason:{' '}
                <em><span className="text-[var(--theme-error)] text-lg">{existingVendor.rejectedReason}</span></em>
              </>
            ) : null}
          </p>
        </div>
      )}

      {submitted ? (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--theme-text)' }}>
            Thanks! Your application is <strong>{state.status}</strong>.
          </p>

          {state.status === 'pending' && (
            <button
              type="button"
              onClick={checkStatusNow}
              className="mt-3 inline-flex rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
            >
              Check approval status
            </button>
          )}

          <a
            href="/vendor/dashboard"
            className="mt-3 ml-2 inline-flex rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
          >
            Go to Vendor Dashboard
          </a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="displayName"
              className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
            >
              Display name
            </label>
            <input
              id="displayName"
              className={fieldClass(Boolean(errors.displayName))}
              value={form.displayName}
              onChange={(e) => setField('displayName', e.target.value)}
              required
              placeholder="e.g., Desert Gems"
              maxLength={120}
            />
            {errors.displayName && (
              <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
                {errors.displayName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="bio"
              className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
            >
              Bio
            </label>
            <textarea
              id="bio"
              className={fieldClass(Boolean(errors.bio))}
              value={form.bio ?? ''}
              onChange={(e) => setField('bio', e.target.value)}
              required
              rows={4}
              placeholder="Tell buyers about your specialization, locality focus, etc."
              maxLength={5000}
            />
            {errors.bio && (
              <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
                {errors.bio}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="logoUrl"
                className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
              >
                Logo URL (beta)
              </label>
              <input
                id="logoUrl"
                className={fieldClass(Boolean(errors.logoUrl))}
                value={form.logoUrl ?? ''}
                onChange={(e) => setField('logoUrl', e.target.value)}
                placeholder="https://…"
                maxLength={500}
              />
              {errors.logoUrl && (
                <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
                  {errors.logoUrl}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="country"
                className="mb-1 block text-sm font-semibold text-[var(--theme-text)]"
              >
                Country
              </label>
              <input
                id="country"
                className={fieldClass(Boolean(errors.country))}
                value={form.country ?? ''}
                onChange={(e) => setField('country', e.target.value.toUpperCase() as any)}
                required
                placeholder="US, GB, FR, etc."
                maxLength={3}
              />
              {errors.country && (
                <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>
                  {errors.country}
                </p>
              )}
            </div>
          </div>

          {state.kind === 'error' && (
            <div
              className="rounded-md border p-3"
              style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card-alt)' }}
            >
              <p className="text-sm" style={{ color: 'var(--theme-error)' }}>
                {state.message}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={state.kind === 'submitting' || hasErrors || !form.displayName.trim()}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--theme-button)', color: 'var(--theme-text-white)' }}
            >
              {state.kind === 'submitting' ? 'Submitting…' : 'Submit application'}
            </button>
            <a
              href="/vendor/dashboard"
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset"
              style={{
                background: 'var(--theme-surface)',
                color: 'var(--theme-text)',
                borderColor: 'var(--theme-border)',
              }}
            >
              Back to dashboard
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
