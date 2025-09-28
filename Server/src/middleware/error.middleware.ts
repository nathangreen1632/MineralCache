// Server/src/middleware/error.middleware.ts
import type { ErrorRequestHandler, Request, Response } from 'express';
import { requestId } from '../utils/reqid.util.js';

function userId(req: Request): number | null {
  const sess = (req.session as any)?.user;
  const authed = (req as any)?.user;
  const id = authed?.id ?? sess?.id ?? null;
  return Number.isFinite(Number(id)) ? Number(id) : null;
}

export function notFoundJson(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    code: 'NOT_FOUND',
    path: req.originalUrl,
    rid: requestId(req),
    uid: userId(req),
  });
}

/** Last-in pipeline — converts thrown errors to JSON; hides stack in prod. */
export const jsonErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  // Prefer explicit statusCode/status on the error; default to 500
  let status =
    (typeof (err).statusCode === 'number' && (err).statusCode) ||
    (typeof (err).status === 'number' && (err).status) ||
    500;

  const isZod = err?.name === 'ZodError' && Array.isArray(err?.issues);
  if (isZod && (status >= 500 || !status)) {
    status = 400; // validation errors are client errors
  }

  const isProd = process.env.NODE_ENV === 'production';
  const payload: Record<string, unknown> = {
    ok: false,
    code: (err && (err.code as string)) || (isZod ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR'),
    message: isProd ? 'Internal server error' : String(err?.message ?? 'Error'),
    rid: requestId(req),
    uid: userId(req),
    path: req.originalUrl,
  };

  // Compact Zod details (path + message), matching the repo's minimal detail shape
  if (isZod) {
    payload.details = (err.issues as any[]).map((i) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
      message: i.message,
      code: i.code,
    }));
  }

  if (!isProd && err?.stack) payload.stack = String(err.stack);

  res.status(status).json(payload);
};
