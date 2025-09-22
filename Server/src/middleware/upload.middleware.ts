// Server/src/middleware/upload.middleware.ts
import multer from 'multer';

const MAX_FILES = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const storage = multer.memoryStorage();

export const uploadPhotos = multer({
  storage,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
  },

  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});
