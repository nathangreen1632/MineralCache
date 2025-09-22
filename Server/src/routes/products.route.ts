// Server/src/routes/products.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { recaptchaMiddleware } from '../middleware/recaptcha.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { createProductSchema, updateProductSchema, listProductsQuerySchema } from '../validation/product.schema.js';
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct, attachImages } from '../controllers/products.controller.js';
import { uploadPhotos, enforceTotalBatchBytes } from '../middleware/upload.middleware.js';

const router: Router = Router();

// Public catalog (with query validation)
router.get('/', validateQuery(listProductsQuerySchema), listProducts);
router.get('/:id', getProduct);

// Vendor CRUD (scoped to the logged-in vendor)
// Order: auth → validate → recaptcha → handler
router.post('/', requireAuth, validateBody(createProductSchema), recaptchaMiddleware, createProduct);
router.patch('/:id', requireAuth, validateBody(updateProductSchema), recaptchaMiddleware, updateProduct);
router.delete('/:id', requireAuth, recaptchaMiddleware, deleteProduct);

// Attach images (≤4) — Multer then total-batch limit then controller
router.post('/:id/images', requireAuth, uploadPhotos.array('photos', 4), enforceTotalBatchBytes, attachImages);

export default router;
