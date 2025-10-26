// Server/src/routes/uploads.route.ts
import { Router, raw } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { uploadPhotos as handleUpload, signUploads, directUpload, finalizeUploads, purgeStagingUploads } from '../controllers/uploads.controller.js';
import { uploadPhotos as photosMulter, enforceTotalBatchBytes } from '../middleware/upload.middleware.js';
import {uploadImagesLimiter, burstLimiter } from '../middleware/rateLimit.middleware.js';

const router: Router = Router();

// Multipart (Multer) flow — field: "photos"
// Order: auth → window limiter → burst limiter → Multer → total-batch limit → handler
router.post('/photos', requireAuth, burstLimiter, photosMulter.array('photos', 6), enforceTotalBatchBytes, handleUpload);

// Signed URL issuance (kept as-is; add limiter here later if needed)
router.post('/sign', requireAuth, signUploads);

// Direct PUT (raw body, bypasses global JSON parser)
// Order: window limiter → burst limiter → raw parser → handler
// (No auth here to preserve your current token-based flow)
router.put('/direct/:token', uploadImagesLimiter, burstLimiter, raw({ type: '*/*', limit: '20mb' }), directUpload);

// Finalize staged uploads -> original + 320/800/1600
// Order: auth → window limiter → burst limiter → handler
router.post('/finalize', requireAuth, uploadImagesLimiter, burstLimiter, finalizeUploads);

// Admin maintenance: purge staged uploads older than N hours (default 24h) with safety margin (default 1h)
router.post('/staging/purge', requireAdmin, burstLimiter, purgeStagingUploads);

export default router;
