// Server/src/routes/uploads.route.ts
import { Router, raw } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  uploadPhotos as handleUpload,
  signUploads,
  directUpload,
  finalizeUploads,
} from '../controllers/uploads.controller.js';
import {
  uploadPhotos as photosMulter,
  enforceTotalBatchBytes, // ✅ total-batch limiter
} from '../middleware/upload.middleware.js';

const router: Router = Router();

// Multipart (Multer) flow — field: "photos"
// Order: auth → Multer → total-batch limit → handler
router.post('/photos', requireAuth, photosMulter.array('photos', 4), enforceTotalBatchBytes, handleUpload);

// Signed URL issuance
router.post('/sign', requireAuth, signUploads);

// Direct PUT (raw body, bypasses global JSON parser)
router.put('/direct/:token', raw({ type: '*/*', limit: '20mb' }), directUpload);

// Finalize staged uploads -> original + 320/800/1600
router.post('/finalize', requireAuth, finalizeUploads);

export default router;
