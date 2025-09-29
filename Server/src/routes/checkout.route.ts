// Server/src/routes/checkout.route.ts
import {json, Router} from 'express';
import { createCheckoutIntent } from '../controllers/checkout.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { checkoutIntentLimiter } from '../middleware/rateLimit.middleware.js';

const router: Router = Router();

// POST /api/checkout/intent
router.post('/intent', requireAuth, json(), checkoutIntentLimiter, createCheckoutIntent);

export default router;
