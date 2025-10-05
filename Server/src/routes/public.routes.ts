import { Router } from 'express';
import { getFeaturedPhotosCtrl, getOnSaleProductsCtrl } from '../controllers/public.controller.js';

export const publicRouter: Router = Router();

// GET /public/featured-photos
publicRouter.get('/featured-photos', getFeaturedPhotosCtrl);

// GET /public/on-sale
publicRouter.get('/on-sale', getOnSaleProductsCtrl);
