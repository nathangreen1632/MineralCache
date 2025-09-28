// Server/src/routes/auctions.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { require18Plus } from '../middleware/ageGate.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import { bidBodySchema, bidParamsSchema } from '../validation/auctions.schema.js';
import { createAuction, getAuction, listAuctions, placeBid, buyNow } from '../controllers/auctions.controller.js';
import { biddingRateLimit } from '../middleware/rateLimit.middleware.js';

const router: Router = Router();

// Public reads
router.get('/', listAuctions);
router.get('/:id', validateParams(bidParamsSchema), getAuction);

// Vendor create (auth required; 18+ not required for creating)
router.post('/', requireAuth, createAuction);

// Bidding & Buy Now (auth + 18+ required)
router.post(
  '/:id/bid',
  requireAuth,
  require18Plus,
  biddingRateLimit,                 // small burst guard
  validateParams(bidParamsSchema),  // validate :id
  validateBody(bidBodySchema),      // validate body
  placeBid
);

router.post(
  '/:id/buy-now',
  requireAuth,
  require18Plus,
  validateParams(bidParamsSchema),
  buyNow
);

export default router;
