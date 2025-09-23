// Server/src/routes/payments.route.ts
import { Router, json } from 'express';
import { createPaymentIntent } from '../controllers/payments.controller.js';

const router: Router = Router();

// JSON for normal endpoints
router.post('/intent', json(), createPaymentIntent);

export default router;
