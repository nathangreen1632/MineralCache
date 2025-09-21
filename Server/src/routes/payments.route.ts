// Server/src/routes/payments.route.ts
import { Router, json, raw } from 'express';
import { createPaymentIntent, stripeWebhook } from '../controllers/payments.controller.js';

const router: Router = Router();

// JSON for normal endpoints
router.post('/intent', json(), createPaymentIntent);

// RAW for Stripe webhook verification
router.post('/webhook', raw({ type: 'application/json' }), stripeWebhook);

export default router;
