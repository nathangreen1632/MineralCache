// Server/src/middleware/rateLimit.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import { requestId } from '../utils/reqid.util.js';

type Bucket = { count: number; resetAt: number };
type KeyFn = (req: Request) => string;

function fixedWindowLimiter(windowMs: number, max: number, keyFn: KeyFn) {
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
function chainLimiters(limiters: Array<(req: Request, res: Response, next: NextFunction) => void>) {
  return function chained(req: Request, res: Response, next: NextFunction) {
    let idx = 0;
    function run(i: number): void {
      if (i >= limiters.length) return next();
      limiters[i](req, res, () => run(i + 1));
    }
    run(idx);
  };
}

function ipKey(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0]?.trim() || req.ip || 'ip-unknown';
  return req.ip || 'ip-unknown';
}

/**
 * Login-specific rate limit:
 * - Burst: 10 requests / 10s per IP
 * - Sustained: 100 requests / 15m per IP
 * Env overrides:
 *   LOGIN_RATE_BURST_MAX, LOGIN_RATE_BURST_WINDOW_MS
 *   LOGIN_RATE_SUSTAIN_MAX, LOGIN_RATE_SUSTAIN_WINDOW_MS
 */
const BURST_MAX = Number.parseInt(process.env.LOGIN_RATE_BURST_MAX ?? '10', 10);
const BURST_WIN = Number.parseInt(process.env.LOGIN_RATE_BURST_WINDOW_MS ?? '10000', 10);
const SUSTAIN_MAX = Number.parseInt(process.env.LOGIN_RATE_SUSTAIN_MAX ?? '100', 10);
const SUSTAIN_WIN = Number.parseInt(process.env.LOGIN_RATE_SUSTAIN_WINDOW_MS ?? '900000', 10);

export const loginRateLimit = chainLimiters([
  fixedWindowLimiter(BURST_WIN, BURST_MAX, ipKey),
  fixedWindowLimiter(SUSTAIN_WIN, SUSTAIN_MAX, ipKey),
]);
