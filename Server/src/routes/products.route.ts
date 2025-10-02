// Server/src/routes/products.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { recaptchaMiddleware } from '../middleware/recaptcha.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { createProductSchema, updateProductSchema, listProductsQuerySchema } from '../validation/product.schema.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  attachImages,
  setPrimaryImage,
  reorderImages,
  softDeleteImage,
  restoreImage,
} from '../controllers/products.controller.js';
import { uploadPhotos, enforceTotalBatchBytes } from '../middleware/upload.middleware.js';
import { uploadImagesLimiter } from '../middleware/uploadRateLimit.middleware.js';
import { burstLimiter } from '../middleware/rateLimit.middleware.js';
import { reorderImagesSchema } from '../validation/productImage.schema.js';

const router: Router = Router();

// Public catalog (with query validation)
router.get('/', validateQuery(listProductsQuerySchema), listProducts);
router.get('/:id', getProduct);

// Vendor CRUD (scoped to the logged-in vendor)
// Order: auth → validate → recaptcha → handler
router.post('/', requireAuth, validateBody(createProductSchema), recaptchaMiddleware, createProduct);
router.patch('/:id', requireAuth, validateBody(updateProductSchema), recaptchaMiddleware, updateProduct);
router.delete('/:id', requireAuth, recaptchaMiddleware, deleteProduct);

// Attach images (≤4)
// Order: auth → rate-limit → multer → total-batch limit → controller
router.post('/:id/images', requireAuth, burstLimiter, uploadImagesLimiter, uploadPhotos.array('photos', 6), enforceTotalBatchBytes, attachImages);

// Photos management (vendor/admin)
// Order: auth → rate-limit → (optional body validation) → handler
router.post('/:id/images/:imageId/primary', requireAuth, burstLimiter, setPrimaryImage);
router.post('/:id/images/reorder', requireAuth, burstLimiter, validateBody(reorderImagesSchema), reorderImages);
router.delete('/:id/images/:imageId', requireAuth, burstLimiter, softDeleteImage);
router.post('/:id/images/:imageId/restore', requireAuth, burstLimiter, restoreImage);

export default router;
