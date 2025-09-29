// Server/src/routes/search.route.ts
import { Router } from 'express';
import { validateQuery } from '../middleware/validate.middleware.js';
import { productSearchQuerySchema } from '../validation/search.schema.js';
import { searchProducts } from '../controllers/search.controller.js';

const router: Router = Router();

// GET /api/search/products?q=term+here&vendorSlug=...&page=1&pageSize=20&sort=newest|price_asc|price_desc
router.get('/', validateQuery(productSearchQuerySchema), searchProducts);

export default router;
