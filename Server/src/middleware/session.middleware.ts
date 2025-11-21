// Server/src/middleware/session.middleware.ts
import cookieSession from 'cookie-session';
import type { RequestHandler } from 'express';

function sessionKeys(): string[] {
  const keys = [process.env.SESSION_SECRET, process.env.SESSION_SECRET_OLD]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0));

  return keys.length > 0 ? keys : ['dev-only-session-secret'];
}

export function buildSessionMiddleware(): RequestHandler {
  const isProd = process.env.NODE_ENV === 'production';

  const rawMaxAge = process.env.SESSION_MAX_AGE_MS?.trim();
  const parsed = rawMaxAge ? Number(rawMaxAge) : NaN;
  const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
  const maxAge = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE;

  const secureEnv = process.env.SESSION_SECURE?.trim().toLowerCase();
  let secure: boolean;
  if (secureEnv === 'true') secure = true;
  else if (secureEnv === 'false') secure = false;
  else secure = isProd;

  return cookieSession({
    name: process.env.SESSION_NAME?.trim() || 'mc.sid',
    keys: sessionKeys(),
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}
