import { Router } from 'express';
import { getMyPayouts } from '../controllers/vendor/payouts.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router: Router = Router();

// GET /api/vendors/me/payouts?start=YYYY-MM-DD&end=YYYY-MM-DD[&format=csv]
router.get('/payouts', requireAuth, getMyPayouts);

export default router;
