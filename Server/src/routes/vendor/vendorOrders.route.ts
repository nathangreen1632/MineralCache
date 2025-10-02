// Server/src/routes/vendor/vendorOrders.route.ts
import { Router } from 'express';
import { requireVendor } from '../../middleware/auth.middleware.js';
import { listVendorOrders } from '../../controllers/vendor/orders.controller.js';
import { getVendorPackingSlip } from '../../controllers/vendor/orders.controller.js';
import {validateQuery} from "../../middleware/validate.middleware.js";
import {vendorPackingSlipQuerySchema} from "../../validation/vendorOrders.schema.js";

const router: Router = Router();

// List orders that contain this vendor's items
router.get('/orders', requireVendor, listVendorOrders);

// HTML packing slip for the current vendor
router.get('/orders/:id/pack', requireVendor, validateQuery(vendorPackingSlipQuerySchema), getVendorPackingSlip);

export default router;
