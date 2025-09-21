// Server/src/routes/cart.route.ts
import { Router, json } from 'express';
import { requireAuthed, requireAdult } from '../middleware/authz.middleware.js';
import { getCart, putCart, checkout } from '../controllers/cart.controller.js';

const router: Router = Router();

// Read cart (auth required)
router.get('/', requireAuthed, getCart);

// Update cart (auth + JSON body)
router.put('/', json(), requireAuthed, putCart);

// Checkout (auth + adult gate + JSON body)
router.post('/checkout', json(), requireAuthed, requireAdult, checkout);

// router.post('/bids', json(), requireAuthed, requireAdult, createBidHandler);


export default router;
