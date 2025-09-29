// Server/src/routes/orders.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listMyOrders,
  getOrder,
  markShipped,
  markDelivered,
  getReceiptHtml,
  cancelPendingOrder, // ✅ NEW
} from '../controllers/orders.controller.js';

const router: Router = Router();

router.get('/', requireAuth, listMyOrders);
router.get('/:id', requireAuth, getOrder);

// Fulfillment (tighten guards later if you have an admin/vendor check)
router.patch('/:id/ship', requireAuth, markShipped);
router.patch('/:id/deliver', requireAuth, markDelivered);

// Buyer cancel (pending only) ✅ NEW
router.patch('/:id/cancel', requireAuth, cancelPendingOrder);

// Receipt (HTML)
router.get('/:id/receipt', requireAuth, getReceiptHtml);

export default router;
