// Server/src/routes/vendor/vendorOrders.route.ts
import { Router } from 'express';
import { requireVendor } from '../../middleware/auth.middleware.js';
import { getVendorPackingSlipHtml, listVendorOrders } from '../../controllers/vendor/orders.controller.js';

const router: Router = Router();

// List orders that contain this vendor's items
router.get('/orders', requireVendor, listVendorOrders);

// HTML packing slip for the current vendor
router.get('/orders/:id/pack', requireVendor, getVendorPackingSlipHtml);

export default router;
