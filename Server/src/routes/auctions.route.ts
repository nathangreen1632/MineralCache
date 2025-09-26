// Server/src/routes/auctions.route.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { require18Plus } from '../middleware/ageGate.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js'; // ✅ NEW
import { placeBidSchema } from '../validation/auctions.schema.js'; // ✅ NEW
import {
  createAuction,
  getAuction,
  listAuctions,
  placeBid,
  buyNow,
} from '../controllers/auctions.controller.js';

const router: Router = Router();

// Public reads
router.get('/', listAuctions);
router.get('/:id', getAuction);

// Vendor create (auth required; 18+ not required for creating)
router.post('/', requireAuth, createAuction);

// Bidding & Buy Now (auth + 18+ required)
router.post('/:id/bid', requireAuth, require18Plus, validateBody(placeBidSchema), placeBid); // ✅ add auth + zod validation
router.post('/:id/buy-now', require18Plus, buyNow);

export default router;
