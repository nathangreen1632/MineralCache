// Server/src/routes/auth.route.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { loginSchema, registerSchema, verify18Schema, forgotPasswordSchema, resetPasswordSchema } from '../validation/auth.schema.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { loginBackoffGuard } from '../middleware/loginBackoff.middleware.js';
import { loginRateLimit, registerLimiter, burstLimiter } from '../middleware/rateLimit.middleware.js';
import {
  register as handleRegister,
  login as handleLogin,
  me as handleMe,
  verify18 as handleVerify18,
  logout as handleLogout,
  forgotPassword as handleForgotPassword,
  resetPassword as handleResetPassword,
} from '../controllers/auth.controller.js';

const router: Router = Router();

router.post('/register', registerLimiter, burstLimiter, validateBody(registerSchema), handleRegister);
router.post('/login', validateBody(loginSchema), loginRateLimit, loginBackoffGuard, handleLogin);
router.get('/me', requireAuth, handleMe);
router.post('/verify-18', requireAuth, validateBody(verify18Schema), handleVerify18);
router.post('/logout', requireAuth, handleLogout);
router.post('/forgot-password', burstLimiter, validateBody(forgotPasswordSchema), handleForgotPassword);
router.post('/reset-password', burstLimiter, validateBody(resetPasswordSchema), handleResetPassword);

export default router;
