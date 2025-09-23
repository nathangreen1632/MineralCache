import type { NextFunction, Request, Response } from 'express';
import { requestId } from '../utils/reqid.util.js';

type Bucket = { count: number; resetAt: number };
type KeyFn = (req: Request) => string;

export function fixedWindowLimiter(windowMs: number, max: number, keyFn: KeyFn) {
  const buckets = new Map<string, Bucket>();

  return function limiter(req: Request, res: Response, next: NextFunction) {
    const key = keyFn(req);
    const now = Date.now();
    const b = buckets.get(key);

    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (b.count < max) {
      b.count += 1;
      return next();
    }

    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      ok: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      rid: requestId(req),
    });
  };
}

/** Compose multiple limiters (e.g., burst + sustained). First to block wins. */
export function chainLimiters(
  limiters: Array<(req: Request, res: Response, next: NextFunction) => void>
) {
  return function chained(req: Request, res: Response, next: NextFunction) {
    let idx = 0;
    function run(i: number): void {
      if (i >= limiters.length) return next();
      limiters[i](req, res, () => run(i + 1));
    }
    run(idx);
  };
}

export function ipKey(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    const first = xf.split(',')[0];
    if (first) return first.trim();
  }
  if (Array.isArray(xf) && xf.length > 0) {
    const first = String(xf[0]).split(',')[0];
    if (first) return first.trim();
  }
  return req.ip || 'ip-unknown';
}

/**
 * Prefer authenticated user id; fall back to IP.
 * This keeps per-user fairness while still protecting anonymous traffic.
 */
export function userOrIpKey(req: Request): string {
  const u = (req as any)?.user;
  if (u && typeof u.id === 'number') {
    return `uid:${u.id}`;
  }
  return ipKey(req);
}

/**
 * Login-specific rate limit:
 * - Burst: 10 requests / 10s per IP
 * - Sustained: 100 requests / 15m per IP
 */
const BURST_MAX = Number.parseInt(process.env.LOGIN_RATE_BURST_MAX ?? '10', 10);
const BURST_WIN = Number.parseInt(process.env.LOGIN_RATE_BURST_WINDOW_MS ?? '10000', 10);
const SUSTAIN_MAX = Number.parseInt(process.env.LOGIN_RATE_SUSTAIN_MAX ?? '100', 10);
const SUSTAIN_WIN = Number.parseInt(process.env.LOGIN_RATE_SUSTAIN_WINDOW_MS ?? '900000', 10);

export const loginRateLimit = chainLimiters([
  fixedWindowLimiter(BURST_WIN, BURST_MAX, ipKey),
  fixedWindowLimiter(SUSTAIN_WIN, SUSTAIN_MAX, ipKey),
]);

/** Generic burst limiter for uploads (e.g., images). Defaults: 5 req / 10s (IP-keyed). */
const UPLOAD_BURST_MAX = Number.parseInt(process.env.UPLOAD_RATE_BURST_MAX ?? '5', 10);
const UPLOAD_BURST_WIN = Number.parseInt(process.env.UPLOAD_RATE_BURST_WINDOW_MS ?? '10000', 10);

export const burstLimiter = fixedWindowLimiter(UPLOAD_BURST_WIN, UPLOAD_BURST_MAX, ipKey);

/**
 * NEW: Uploads window limiter (user-or-IP keyed).
 * Defaults:
 *   - UPLOADS_WINDOW_MS: 600000 (10 minutes)
 *   - UPLOADS_MAX_REQUESTS: 30 requests per window
 *
 * Use alongside `burstLimiter` where appropriate.
 */
const UPLOADS_WINDOW_MS = Number.parseInt(process.env.UPLOADS_WINDOW_MS ?? '600000', 10);
const UPLOADS_MAX_REQUESTS = Number.parseInt(process.env.UPLOADS_MAX_REQUESTS ?? '30', 10);

export const uploadImagesLimiter = fixedWindowLimiter(
  UPLOADS_WINDOW_MS,
  UPLOADS_MAX_REQUESTS,
  userOrIpKey
);
