import { Router } from 'express';
import {
  listPublicCategories,
  getFeaturedPhotosCtrl,
  getOnSaleProductsCtrl,
  listPublicProductsCtrl, getPublicConfigCtrl, getPublicProductCtrl,    // ← NEW
} from '../controllers/public.controller.js';

export const publicRouter: Router = Router();

publicRouter.get('/featured-photos', getFeaturedPhotosCtrl);
publicRouter.get('/on-sale', getOnSaleProductsCtrl);
publicRouter.get('/categories', listPublicCategories);

// NEW: the endpoint your Category page calls
publicRouter.get('/products/:id', getPublicProductCtrl);
publicRouter.get('/products', listPublicProductsCtrl);
publicRouter.get('/config', getPublicConfigCtrl);