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

function makeValidator<T>(pick: 'body' | 'query' | 'params', schema: ZodType<T>) {
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

export function validateQuery<T>(schema: ZodType<T>) {
  return makeValidator('query', schema);
}

export function validateParams<T>(schema: ZodType<T>) {
  return makeValidator('params', schema);
}
