// Server/src/routes/vendors.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js'; // ✅ route-level validation
import { applyVendorSchema } from '../validation/vendor.schema.js';   // ✅ schema for /apply
import {
  applyVendor,
  getMyVendor,
  getVendorBySlug,
  getVendorOrders,
  linkStripeOnboarding,
} from '../controllers/vendors.controller.js';

const router: Router = Router();

// Authenticated vendor application + profile
router.post('/apply', requireAuth, validateBody(applyVendorSchema), applyVendor); // ✅ validate here
router.get('/me', requireAuth, getMyVendor);

// Stripe onboarding link (requires approved vendor)
router.post('/me/stripe/link', requireAuth, linkStripeOnboarding);

// Vendor's own orders
router.get('/me/orders', requireAuth, getVendorOrders);

// Public vendor profile by slug — keep LAST to avoid swallowing other routes
router.get('/:slug', getVendorBySlug);

export default router;
