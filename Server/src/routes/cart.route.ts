// Server/src/routes/cart.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getCart, putCart, checkout } from '../controllers/cart.controller.js';

const router: Router = Router();

router.get('/', requireAuth, getCart);
router.put('/', requireAuth, putCart);
router.post('/checkout', requireAuth, checkout);

export default router;
