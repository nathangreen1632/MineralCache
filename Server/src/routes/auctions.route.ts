// Server/src/routes/auctions.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createAuction,
  getAuction,
  listAuctions,
  placeBid,
  buyNow,
} from '../controllers/auctions.controller.js';

const router: Router = Router();

router.get('/', listAuctions);
router.get('/:id', getAuction);
router.post('/', requireAuth, createAuction);
router.post('/:id/bid', requireAuth, placeBid);
router.post('/:id/buy-now', requireAuth, buyNow);

export default router;
