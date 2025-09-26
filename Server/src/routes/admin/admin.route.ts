// Server/src/routes/admin/admin.route.ts
import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware.js';
import { burstLimiter } from '../../middleware/rateLimit.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { adminListVendorsSchema, adminRejectSchema } from '../../validation/vendor.schema.js';
import { updateAdminSettingsSchema } from '../../validation/adminSettings.schema.js';
import { listVendorApps, approveVendor, rejectVendor, getAdminSettings, patchAdminSettings } from '../../controllers/admin/admin.controller.js';
import { shippingRulesRouter } from './shippingRules.route.js';
import { adminListOrdersSchema } from '../../validation/adminOrders.schema.js'; // ✅ NEW
import { listAdminOrders, getAdminOrder } from '../../controllers/admin/orders.controller.js'; // ✅ NEW

const router: Router = Router();

// Vendor applications: list / approve / reject
router.get('/vendor-apps', requireAdmin, validateQuery(adminListVendorsSchema), listVendorApps);
router.post('/vendor-apps/:id/approve', requireAdmin, approveVendor);
router.post('/vendor-apps/:id/reject', requireAdmin, validateBody(adminRejectSchema), rejectVendor);

// Platform settings
// Keep the route shape the same, but use the new handlers + limiter + body validation.
router.get('/settings', requireAdmin, burstLimiter, getAdminSettings);
router.patch('/settings', requireAdmin, burstLimiter, validateBody(updateAdminSettingsSchema), patchAdminSettings);

// Shipping rules (admin)
router.use('/shipping-rules', requireAdmin, shippingRulesRouter);

// Orders (admin) ✅ NEW
router.get('/orders', requireAdmin, burstLimiter, validateQuery(adminListOrdersSchema), listAdminOrders);
router.get('/orders/:id', requireAdmin, burstLimiter, getAdminOrder);

export default router;
