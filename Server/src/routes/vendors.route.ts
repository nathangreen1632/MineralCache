// Server/src/routes/vendors.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  applyVendor,
  getMyVendor,
  getVendorBySlug,
  getVendorOrders,
  linkStripeOnboarding,
} from '../controllers/vendors.controller.js';

const router: Router = Router();

router.post('/apply', requireAuth, applyVendor);
router.get('/me', requireAuth, getMyVendor);
router.post('/me/stripe/link', requireAuth, linkStripeOnboarding);
router.get('/:slug', getVendorBySlug);
router.get('/me/orders', requireAuth, getVendorOrders);

export default router;
