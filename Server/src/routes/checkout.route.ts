// Server/src/routes/checkout.route.ts
import { Router } from 'express';
import { require18Plus } from '../middleware/ageGate.middleware.js';
import { createCheckout } from '../controllers/checkout.controller.js';

const router: Router = Router();

// POST /api/checkout
router.post('/', require18Plus, createCheckout);

export default router;
