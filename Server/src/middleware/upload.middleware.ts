// Server/src/middleware/upload.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

// ---- limits (env-overridable) ----
const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES ?? 6);
const MAX_FILE_BYTES = Number(process.env.UPLOAD_MAX_FILE_BYTES ?? 10 * 1024 * 1024); // 10MB/file
// Total batch size across all images in a single request (default 10MB)
const MAX_BATCH_BYTES = Number(process.env.UPLOAD_MAX_BATCH_BYTES ?? 20 * 1024 * 1024);

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// Memory storage; sharp derivatives happen later in the controller
const storage = multer.memoryStorage();

// ✅ Type the filter using Multer's own signature
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(new Error('Unsupported image type'));
    return;
  }
  // Some Multer typings don't allow `null` here, so use `as any` to satisfy both variants.
  cb(null as any, true);
};

export const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_BYTES,
  },
});

// ------------------------------
// Total-batch size limiter
// Must run *after* Multer so we can sum file sizes.
// ------------------------------
export function enforceTotalBatchBytes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  // Not a multipart request or no files -> continue
  if (!Array.isArray(files) || files.length === 0) {
    next();
    return;
  }

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    res.status(413).json({
      error: 'Upload too large',
      code: 'UPLOAD_TOTAL_LIMIT',
      totalBytes,
      limitBytes: MAX_BATCH_BYTES,
      message: `Total images must be ≤ ${Math.round(MAX_BATCH_BYTES / 1048576)}MB.`,
    });
    return;
  }

  next();
}
