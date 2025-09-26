import { Router } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { requireVendor } from '../../middleware/auth.middleware.js';
import { vendorListProductsSchema, vendorUpdateProductSchema } from '../../validation/vendorProducts.schema.js';
import { listVendorProducts, updateVendorProduct } from '../../controllers/vendor/products.controller.js';

export const vendorProductsRouter: Router = Router();

// GET /api/vendor/products
vendorProductsRouter.get('/', requireVendor, validateQuery(vendorListProductsSchema), listVendorProducts);

// PUT /api/vendor/products/:id
vendorProductsRouter.put('/:id', requireVendor, validateBody(vendorUpdateProductSchema), updateVendorProduct);
