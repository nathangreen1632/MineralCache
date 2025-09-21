// Server/src/routes/admin/admin.route.ts
import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware.js';
import {
  listVendorApps,
  approveVendor,
  rejectVendor,
  getSettings,
  updateSettings,
} from '../../controllers/admin/admin.controller.js';

const router: Router = Router();

router.get('/vendor-apps', requireAdmin, listVendorApps);
router.patch('/vendors/:id/approve', requireAdmin, approveVendor);
router.patch('/vendors/:id/reject', requireAdmin, rejectVendor);
router.get('/settings', requireAdmin, getSettings);
router.patch('/settings', requireAdmin, updateSettings);

export default router;
