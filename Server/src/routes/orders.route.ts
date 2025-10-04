// Server/src/routes/orders.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listMyOrders,
  getOrder,
  markShipped,
  markDelivered,
  getReceiptHtml,
  cancelPendingOrder,
  getReceiptPdf, // ✅ NEW
} from '../controllers/orders.controller.js';
import {validateBody} from "../middleware/validate.middleware.js";
import {deliverOrderSchema, shipOrderSchema} from "../validation/orders.schema.js";

const router: Router = Router();

router.get('/', requireAuth, listMyOrders);
router.get('/:id', requireAuth, getOrder);

// Fulfillment (tighten guards later if you have an admin/vendor check)
router.patch('/:id/ship', requireAuth, validateBody(shipOrderSchema), markShipped);
router.patch('/:id/deliver', requireAuth, validateBody(deliverOrderSchema), markDelivered);

// Buyer cancel (pending only)
router.patch('/:id/cancel', requireAuth, cancelPendingOrder);

// Receipt (HTML)
router.get('/:id/receipt', requireAuth, getReceiptHtml);

// Receipt (PDF) ✅ NEW
router.get('/:id/receipt.pdf', requireAuth, getReceiptPdf);

export default router;
