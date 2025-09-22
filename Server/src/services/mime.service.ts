// Server/src/services/mime.service.ts
import { fileTypeFromBuffer } from 'file-type';

export const ALLOWED_IMAGE_MIME = new Map<string, 'jpg' | 'png' | 'webp' | 'avif'>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

export type ValidatedImage = {
  buffer: Buffer;
  mime: string;
  ext: 'jpg' | 'png' | 'webp' | 'avif';
};

/**
 * Trust the bytes, not the filename/mimetype.
 * Throws on unsupported or unknown file types.
 */
export async function validateMulterImage(
  file: Express.Multer.File
): Promise<ValidatedImage> {
  if (!file?.buffer?.length) {
    throw new Error('Empty upload');
  }

  const sniff = await fileTypeFromBuffer(file.buffer);
  const detectedMime = sniff?.mime ?? null;

  if (!detectedMime || !ALLOWED_IMAGE_MIME.has(detectedMime)) {
    const declared = file.mimetype || 'unknown';
    throw new Error(`Unsupported image type (declared: ${declared}, detected: ${detectedMime ?? 'unknown'})`);
  }

  const ext = ALLOWED_IMAGE_MIME.get(detectedMime)!;
  return { buffer: file.buffer, mime: detectedMime, ext };
}

/**
 * Validate a batch of multer files. Throws on first failure.
 * Returns the normalized/validated images (same order).
 */
export async function validateAllImages(
  files: Express.Multer.File[]
): Promise<ValidatedImage[]> {
  const out: ValidatedImage[] = [];
  for (const f of files) {
    out.push(await validateMulterImage(f));
  }
  return out;
}
