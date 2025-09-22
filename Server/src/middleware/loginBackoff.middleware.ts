// Server/src/middleware/loginBackoff.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import { shouldThrottle, recordLoginFailure, clearLoginFailures } from '../services/loginBackoff.service.js';
import { requestId } from '../utils/reqid.util.js';

/**
 * Guards POST /auth/login with IP+email backoff and logs outcome.
 * Requires body { email: string } to be validated already (Zod).
 */
export function loginBackoffGuard(req: Request, res: Response, next: NextFunction) {
  const ip = clientIp(req);
  const email = safeEmail(req.body?.email);

  // If email isn't present (shouldn't happen after Zod), skip guard.
  if (!email) return next();

  // Attach a finish listener to record success/failure after controller runs.
  // We attach this before the pre-check so even 429 responses get logged once.
  res.once('finish', () => {
    try {
      // 2xx -> success: clear failures
      if (res.statusCode >= 200 && res.statusCode < 300) {
        clearLoginFailures(email, ip);
        console.info(
          `[auth.backoff] success email=${maskEmail(email)} ip=${ip} status=${res.statusCode} rid=${requestId(req)}`
        );
        return;
      }
      // 401/403 => count as failed login attempt
      if (res.statusCode === 401 || res.statusCode === 403) {
        recordLoginFailure(email, ip);
        console.warn(
          `[auth.backoff] fail email=${maskEmail(email)} ip=${ip} status=${res.statusCode} rid=${requestId(req)}`
        );
      }
    } catch {
      // swallow — logging/backoff should never crash request
    }
  });

  // Pre-check: block if still backing off
  const pre = shouldThrottle(email, ip);
  if (pre.blocked) {
    res.setHeader('Retry-After', String(pre.retryAfterSec));
    console.warn(
      `[auth.backoff] throttled email=${maskEmail(email)} ip=${ip} retryAfter=${pre.retryAfterSec}s rid=${requestId(req)}`
    );
    return res.status(429).json({
      ok: false,
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many login attempts. Please try again later.',
    });
  }

  return next();
}

// ---------------- helpers ----------------

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    // Take the first IP in the list
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'ip-unknown';
}

function safeEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.toLowerCase() : null;
}

function maskEmail(email: string): string {
  // obfuscate for logs: j***@domain.com
  const [user, domain] = email.split('@');
  if (!user || !domain) return 'email-invalid';
  const head = user.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}
