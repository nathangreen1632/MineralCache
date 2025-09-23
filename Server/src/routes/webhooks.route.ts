// Server/src/routes/webhooks.route.ts
import { Router, raw } from 'express';
import { stripeWebhook } from '../controllers/payments.controller.js';

const router: Router = Router();

// Stripe requires the raw body for signature verification
router.post('/stripe', raw({ type: 'application/json' }), stripeWebhook);

export default router;
