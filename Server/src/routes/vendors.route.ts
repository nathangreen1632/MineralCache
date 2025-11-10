// Server/src/routes/vendors.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { applyVendorSchema } from '../validation/vendor.schema.js';
import {
  applyVendor,
  getMyVendor,
  getVendorBySlug,
  getVendorOrders,
  linkStripeOnboarding,
  syncMyStripeStatus,
} from '../controllers/vendors.controller.js';
import { vendorProductsRouter } from './vendor/vendorProducts.route.js';

const router: Router = Router();

router.post('/apply', requireAuth, validateBody(applyVendorSchema), applyVendor);
router.get('/me', requireAuth, getMyVendor);

router.post('/me/stripe/link', requireAuth, linkStripeOnboarding);
router.post('/me/stripe/sync', requireAuth, syncMyStripeStatus);

router.get('/me/orders', requireAuth, getVendorOrders);

router.use('/me/products', requireAuth, vendorProductsRouter);

router.get('/:slug', getVendorBySlug);

export default router;
