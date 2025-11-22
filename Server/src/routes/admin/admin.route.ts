// Server/src/routes/admin/admin.route.ts
import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { adminListVendorsSchema, adminRejectSchema } from '../../validation/vendor.schema.js';
import { updateAdminSettingsSchema } from '../../validation/adminSettings.schema.js';
import { adminPromoteSchema } from '../../validation/adminUsers.schema.js';
import {
  listVendorApps,
  approveVendor,
  rejectVendor,
  getAdminSettings,
  patchAdminSettings,
  promoteUserByEmail,
} from '../../controllers/admin/admin.controller.js';
import { getAdminPulse } from '../../controllers/admin/pulse.controller.js';
import { shippingRulesRouter } from './shippingRules.route.js';
import { adminListOrdersQuerySchema } from '../../validation/adminOrders.schema.js';
import {
  listAdminOrders,
  getAdminOrder,
  refundOrder,
  exportAdminOrdersCsv,
} from '../../controllers/admin/orders.controller.js';
import { runPayoutsNow } from '../../controllers/admin/payouts.controller.js';

const router: Router = Router();

router.get('/pulse', requireAdmin, getAdminPulse);

router.get('/vendor-apps', requireAdmin, validateQuery(adminListVendorsSchema), listVendorApps);
router.post('/vendor-apps/:id/approve', requireAdmin, approveVendor);
router.post('/vendor-apps/:id/reject', requireAdmin, validateBody(adminRejectSchema), rejectVendor);

router.get('/settings', requireAdmin, getAdminSettings);
router.patch('/settings', requireAdmin, validateBody(updateAdminSettingsSchema), patchAdminSettings);

router.use('/shipping-rules', requireAdmin, shippingRulesRouter);

router.get('/orders.csv', requireAdmin, exportAdminOrdersCsv);
router.get('/orders', requireAdmin, validateQuery(adminListOrdersQuerySchema), listAdminOrders);
router.get('/orders/:id', requireAdmin, getAdminOrder);
router.post('/orders/:id/refund', requireAdmin, refundOrder);

router.post('/users/promote', requireAdmin, validateBody(adminPromoteSchema), promoteUserByEmail);

router.post('/payouts/run', requireAdmin, runPayoutsNow);

export default router;
