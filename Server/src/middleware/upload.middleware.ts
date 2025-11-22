import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES ?? 6);
const MAX_FILE_BYTES = Number(
  process.env.UPLOAD_MAX_FILE_BYTES ?? 10 * 1024 * 1024
);
const MAX_BATCH_BYTES = Number(
  process.env.UPLOAD_MAX_BATCH_BYTES ?? 20 * 1024 * 1024
);

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const storage = multer.memoryStorage();

type FileLike = { mimetype?: string | null };
type FileFilterCb = (error: Error | null, acceptFile?: boolean) => void;

const fileFilter = (_req: Request, file: FileLike, cb: FileFilterCb): void => {
  if (!file.mimetype || !ALLOWED_MIME.has(file.mimetype)) {
    cb(new Error('Unsupported image type'));
    return;
  }
  cb(null, true);
};

export const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_BYTES,
  },
});

type UploadedFileLike = { size?: number };

export function enforceTotalBatchBytes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const files = (req.files as UploadedFileLike[] | undefined) ?? [];

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
      message: `Total images must be ≤ ${Math.round(
        MAX_BATCH_BYTES / 1048576
      )}MB.`,
    });
    return;
  }

  next();
}
