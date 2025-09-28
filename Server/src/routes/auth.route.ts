// Server/src/routes/auth.route.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { loginSchema, registerSchema, verify18Schema } from '../validation/auth.schema.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { loginBackoffGuard } from '../middleware/loginBackoff.middleware.js';
import { loginRateLimit, registerLimiter, burstLimiter } from '../middleware/rateLimit.middleware.js';
import {
  register as handleRegister,
  login as handleLogin,
  me as handleMe,
  verify18 as handleVerify18,
  logout as handleLogout,
} from '../controllers/auth.controller.js';

const router: Router = Router();

// POST /api/auth/register
// ✅ order: window limiter → burst limiter → validate → handler
router.post('/register', registerLimiter, burstLimiter, validateBody(registerSchema), handleRegister);

// POST /api/auth/login
// ✅ order: validate → rate-limit → backoff → controller
router.post('/login', validateBody(loginSchema), loginRateLimit, loginBackoffGuard, handleLogin);

// GET /api/auth/me
router.get('/me', requireAuth, handleMe);

// POST /api/auth/verify-18
router.post('/verify-18', requireAuth, validateBody(verify18Schema), handleVerify18);

// POST /api/auth/logout
router.post('/logout', requireAuth, handleLogout);

export default router;
