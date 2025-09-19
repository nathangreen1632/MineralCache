// Server/src/middleware/upload.middleware.ts
import multer from 'multer';
export const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { files: 4, fileSize: 10 * 1024 * 1024 }, // 10MB total-ish
});
