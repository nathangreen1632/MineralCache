// Server/src/middleware/recaptcha.middleware.ts
import type { Request, Response, NextFunction } from 'express';
export async function recaptchaMiddleware(_req: Request, _res: Response, next: NextFunction): Promise<void> {
  // TODO: wire Recaptcha v later; pass-through for dev
  next();
}
