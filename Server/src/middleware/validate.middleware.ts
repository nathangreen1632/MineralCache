// Server/src/middleware/validate.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';

type ErrItem = { path: string; message: string };
type ValidationErrorResponse = {
  ok: false;
  code: 'VALIDATION_FAILED';
  errors: ErrItem[];
};

function toValidationResponse(err: ZodError): ValidationErrorResponse {
  const errors: ErrItem[] = err.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
  return { ok: false, code: 'VALIDATION_FAILED', errors };
}

/** Generic validator for writable request bags (body, params). */
function makeValidator<T>(pick: 'body' | 'params', schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const candidate = (req as any)[pick];
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      return res.status(400).json(toValidationResponse(parsed.error));
    }
    // Replace with parsed/sanitized data
    (req as any)[pick] = parsed.data;
    return next();
  };
}

export function validateBody<T>(schema: ZodType<T>) {
  return makeValidator('body', schema);
}

export function validateParams<T>(schema: ZodType<T>) {
  return makeValidator('params', schema);
}

/**
 * Special-case for Express 5: req.query is a read-only getter.
 * Validate but DO NOT assign back to req.query; stash on res.locals.query instead.
 */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(toValidationResponse(parsed.error));
    }
    // Store validated query for controllers to read
    res.locals.query = parsed.data;
    return next();
  };
}
