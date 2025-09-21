// Server/src/routes/orders.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listMyOrders,
  getOrder,
  markShipped,
  markDelivered,
} from '../controllers/orders.controller.js';

const router: Router = Router();

router.get('/', requireAuth, listMyOrders);
router.get('/:id', requireAuth, getOrder);
router.patch('/:id/ship', requireAuth, markShipped);
router.patch('/:id/deliver', requireAuth, markDelivered);

export default router;
