// Server/src/routes/products.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { recaptchaMiddleware } from '../middleware/recaptcha.middleware.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  attachImages,
} from '../controllers/products.controller.js';
import { uploadPhotos } from '../middleware/upload.middleware.js';

const router: Router = Router();

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', requireAuth, recaptchaMiddleware, createProduct);
router.patch('/:id', requireAuth, recaptchaMiddleware, updateProduct);
router.delete('/:id', requireAuth, recaptchaMiddleware, deleteProduct);
router.post('/:id/images', requireAuth, uploadPhotos.array('photos', 4), attachImages);

export default router;
