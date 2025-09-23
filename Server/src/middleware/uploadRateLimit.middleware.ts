// Server/src/middleware/uploadRateLimit.middleware.ts
import type { Request } from 'express';
import { fixedWindowLimiter, ipKey } from './rateLimit.middleware.js';

// Defaults are conservative; override in env for prod
const WINDOW_MS =
  Number.parseInt(process.env.UPLOAD_RATE_WINDOW_MS ?? '', 10) || 10 * 60 * 1000; // 10 min
const MAX_REQUESTS =
  Number.parseInt(process.env.UPLOAD_RATE_MAX_REQUESTS ?? '', 10) || 12; // 12 req / window

// Key by authenticated user id when available; otherwise fall back to proxy-aware IP
function keyByUserOrIp(req: Request): string {
  const u = (req as any)?.user ?? (req.session as any)?.user;
  if (u?.id) return `u:${u.id}`;
  return `ip:${ipKey(req)}`;
}

/** Rate limiter for image uploads (fixed window). */
export const uploadImagesLimiter = fixedWindowLimiter(WINDOW_MS, MAX_REQUESTS, keyByUserOrIp);
