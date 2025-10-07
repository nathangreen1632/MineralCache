// Server/src/routes/vendor/vendorOrders.route.ts
import { Router } from 'express';
import { requireVendor } from '../../middleware/auth.middleware.js';
import { listVendorOrders, getPackingSlipHtml } from '../../controllers/vendor/orders.controller.js';
import { validateQuery } from '../../middleware/validate.middleware.js';
import { vendorPackingSlipQuerySchema } from '../../validation/vendorOrders.schema.js';

const router: Router = Router();

// List orders that contain this vendor's items
router.get('/orders', requireVendor, listVendorOrders);

// Printable HTML packing slip for the current vendor’s items in an order
router.get('/orders/:id/packing-slip', requireVendor, validateQuery(vendorPackingSlipQuerySchema), getPackingSlipHtml);

export default router;
