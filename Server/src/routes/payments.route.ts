// Server/src/routes/payments.route.ts
import { Router } from 'express';
import { createPaymentIntent } from '../controllers/payments.controller.js';

const router: Router = Router();

// flat definitions only; handlers return Promise<void>
router.post('/intent', createPaymentIntent);

export default router;
