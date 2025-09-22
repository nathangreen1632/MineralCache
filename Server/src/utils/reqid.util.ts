// Server/src/utils/reqid.util.ts
import type { Request } from 'express';

/**
 * Returns a stable request id:
 * 1) prefer req.id (set by requestId middleware),
 * 2) then X-Request-Id header,
 * 3) then legacy X-RequestId header,
 * 4) else 'req-unknown'.
 */
export function requestId(req: Request): string {
  const fromProp = (req as any).id as string | undefined;
  if (typeof fromProp === 'string' && fromProp.trim().length > 0) {
    return fromProp.trim();
  }

  const hdr1 = (req.headers['x-request-id'] as string | undefined)?.trim();
  if (hdr1 && hdr1.length > 0) return hdr1;

  const hdr2 = (req.headers['x-requestid'] as string | undefined)?.trim();
  if (hdr2 && hdr2.length > 0) return hdr2;

  return 'req-unknown';
}
