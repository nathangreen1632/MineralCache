// Server/src/bootstrap/session.middleware.ts
import cookieSession from 'cookie-session';
import type { RequestHandler } from 'express';

function sessionKeys(): string[] {
  // Collect possible secrets, trim, and keep only non-empty strings.
  const keys = [process.env.SESSION_SECRET, process.env.SESSION_SECRET_OLD]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0));

  // Dev-safe fallback so local runs don’t crash; set real keys in prod.
  return keys.length > 0 ? keys : ['dev-only-session-secret'];
}

/** Cookie session with secure defaults; register early in app bootstrap. */
export function buildSessionMiddleware(): RequestHandler {
  const isProd = process.env.NODE_ENV === 'production';

  // Robust maxAge parse with sane default (7 days)
  const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
  const rawMaxAge = process.env.SESSION_MAX_AGE_MS?.trim();
  const parsed = rawMaxAge ? Number(rawMaxAge) : NaN;
  const maxAge = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE;

  return cookieSession({
    name: (process.env.SESSION_NAME?.trim() || 'mc.sid'),
    keys: sessionKeys(),
    httpOnly: true,
    secure: isProd,   // only over HTTPS in prod
    sameSite: 'lax',  // CSRF-safe default
    path: '/',
    // domain: process.env.COOKIE_DOMAIN?.trim() || undefined, // opt-in if needed
    maxAge,
  });
}
