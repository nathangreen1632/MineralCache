// Server/src/routes/auctions.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { require18Plus } from '../middleware/ageGate.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import { bidBodySchema, bidParamsSchema, createAuctionBodySchema } from '../validation/auctions.schema.js';
import { createAuction, watchAuction, unwatchAuction, closeAuction, cancelAuction } from '../controllers/auctionsReadWrite.controller.js';
import { buyNow, placeBid, listAuctions, getAuction, getMinimumBid } from '../controllers/auctions.controller.js';

import { biddingRateLimit } from '../middleware/rateLimit.middleware.js';

const router: Router = Router();

// Public reads
router.get('/', listAuctions);
router.get('/:id/minimum', validateParams(bidParamsSchema), getMinimumBid);
router.get('/:id', validateParams(bidParamsSchema), getAuction);

// Vendor create (auth required; 18+ not required for creating)
router.post('/', requireAuth, validateBody(createAuctionBodySchema), createAuction);

// Bidding & Buy Now (auth + 18+ required)
router.post('/:id/bid', requireAuth, require18Plus, biddingRateLimit, validateParams(bidParamsSchema), validateBody(bidBodySchema), placeBid);
router.post('/:id/buy-now', requireAuth, require18Plus, validateParams(bidParamsSchema), buyNow);

// Watchlist (auth required)
router.post('/:id/watch', requireAuth, validateParams(bidParamsSchema), watchAuction);
router.delete('/:id/watch', requireAuth, validateParams(bidParamsSchema), unwatchAuction);

// Close / Cancel (vendor owner or admin; 18+ not required)
router.post('/:id/close', requireAuth, validateParams(bidParamsSchema), closeAuction);
router.post('/:id/cancel', requireAuth, validateParams(bidParamsSchema), cancelAuction);

export default router;
