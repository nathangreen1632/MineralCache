// Server/src/routes/index.ts
import { Router } from 'express';
import adminRouter from './admin/admin.route.js';
import authRouter from './auth.route.js';
import paymentsRouter from './payments.route.js';
import vendorsRouter from './vendors.route.js';
import productsRouter from './products.route.js';
import auctionsRouter from './auctions.route.js';
import cartRouter from './cart.route.js';
import ordersRouter from './orders.route.js';
import healthRouter from './health.route.js';
import uploadsRouter from './uploads.route.js';

const router: Router = Router();

router.use('/admin', adminRouter);
router.use('/auth', authRouter);
router.use('/payments', paymentsRouter);
router.use('/vendors', vendorsRouter);
router.use('/products', productsRouter);
router.use('/auctions', auctionsRouter);
router.use('/cart', cartRouter);
router.use('/orders', ordersRouter);
router.use('/health', healthRouter);
router.use('/uploads', uploadsRouter);

export default router;
