// Server/src/routes/admin/admin.route.ts
import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { adminListVendorsSchema, adminRejectSchema } from '../../validation/vendor.schema.js';

// Admin settings + vendor app endpoints (existing controllers)
import {
  getSettings,
  updateSettings,
  listVendorApps,
  approveVendor,
  rejectVendor,
} from '../../controllers/admin/admin.controller.js';

const router: Router = Router();

// Vendor applications: list / approve / reject
router.get('/vendor-apps', requireAdmin, validateQuery(adminListVendorsSchema), listVendorApps);
router.post('/vendor-apps/:id/approve', requireAdmin, approveVendor);
router.post('/vendor-apps/:id/reject', requireAdmin, validateBody(adminRejectSchema), rejectVendor);

// Platform settings
router.get('/settings', requireAdmin, getSettings);
router.patch('/settings', requireAdmin, updateSettings);

export default router;
