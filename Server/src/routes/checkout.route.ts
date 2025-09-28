// Server/src/routes/checkout.route.ts
import { Router, json } from 'express';
import { require18Plus } from '../middleware/ageGate.middleware.js';
import { createCheckoutIntent } from '../controllers/checkout.controller.js';

const router: Router = Router();

// POST /api/checkout/intent
router.post('/intent', require18Plus, json(), createCheckoutIntent);

export default router;
