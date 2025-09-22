// Server/src/middleware/requestId.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const HDR = 'x-request-id';

/** Ensures every request has an X-Request-Id; sets req.id and echoes it in the response. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers[HDR] as string | undefined)?.trim();
  const rid = incoming && incoming.length > 0 ? incoming : randomUUID();
  (req as any).id = rid;
  res.setHeader('X-Request-Id', rid);
  next();
}
