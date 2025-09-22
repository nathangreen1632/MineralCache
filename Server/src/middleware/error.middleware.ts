// Server/src/middleware/error.middleware.ts
import type { ErrorRequestHandler, Request, Response } from 'express';
import { requestId } from '../utils/reqid.util.js';

export function notFoundJson(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    code: 'NOT_FOUND',
    path: req.originalUrl,
    rid: requestId(req),
  });
}

/** Last-in pipeline — converts thrown errors to JSON; hides stack in prod. */
export const jsonErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return; // delegate to default if already started
  const status =
    (typeof (err).statusCode === 'number' && (err).statusCode) ||
    (typeof (err).status === 'number' && (err).status) ||
    500;

  const isProd = process.env.NODE_ENV === 'production';
  const payload: Record<string, unknown> = {
    ok: false,
    code: (err && (err.code as string)) || 'INTERNAL_SERVER_ERROR',
    message: isProd ? 'Internal server error' : String(err?.message ?? 'Error'),
    rid: requestId(req),
  };
  if (!isProd && err?.stack) payload.stack = String(err.stack);

  res.status(status).json(payload);
};
