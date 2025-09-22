// Server/src/services/image.service.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';

type VariantSize = 320 | 800 | 1600;

export type SavedVariant = {
  size: VariantSize;
  width: number;
  height: number;
  bytes: number;
  path: string;   // relative path under UPLOADS_DIR (e.g., images/2025/09/abc_800.jpg)
  url: string;    // public URL (e.g., /uploads/images/2025/09/abc_800.jpg)
};

export type SavedImage = {
  id: string;
  original: Omit<SavedVariant, 'size'> & { size?: undefined };
  variants: SavedVariant[];
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const DERIVATIVE_SIZES: VariantSize[] = [320, 800, 1600];

// Where files are written (must match app.ts)
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/data/uploads';
const PUBLIC_PREFIX = '/uploads'; // mounted in app.ts

function ensureLeadingSlash(s: string) {
  return s.startsWith('/') ? s : `/${s}`;
}

function publicUrl(relPath: string) {
  return ensureLeadingSlash(path.posix.join(PUBLIC_PREFIX, relPath.replaceAll('\\', '/')));
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function datedKeyBase() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return path.posix.join('images', `${yyyy}`, `${mm}`);
}

async function writeFileToUploads(relPath: string, data: Buffer): Promise<void> {
  const abs = path.resolve(UPLOADS_DIR, relPath);
  await ensureDir(path.dirname(abs));
  await fs.writeFile(abs, data);
}

export async function processImageBuffer(
  buf: Buffer,
  opts?: { jpegQuality?: number }
): Promise<SavedImage> {
  // MIME sniff
  const type = await fileTypeFromBuffer(buf);
  const mime = type?.mime || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`Unsupported image type: ${mime}`);
  }

  // Normalize/rotate, keep max fidelity for the "original" we store
  const img = sharp(buf, { failOn: 'none' }).rotate();
  const originalJpeg = await img.jpeg({ quality: Math.min(opts?.jpegQuality ?? 88, 95) }).toBuffer();
  const originalMeta = await sharp(originalJpeg).metadata();

  // Key base
  const baseKey = datedKeyBase();
  const id = randomUUID().replace(/-/g, '');
  const origRel = path.posix.join(baseKey, `${id}_orig.jpg`);
  await writeFileToUploads(origRel, originalJpeg);

  const original: SavedImage['original'] = {
    width: originalMeta.width ?? 0,
    height: originalMeta.height ?? 0,
    bytes: originalJpeg.byteLength,
    path: origRel,
    url: publicUrl(origRel),
  };

  // Derivatives
  const variants: SavedVariant[] = [];
  for (const size of DERIVATIVE_SIZES) {
    const resized = await sharp(originalJpeg)
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: Math.min(opts?.jpegQuality ?? 82, 95) })
      .toBuffer();

    const meta = await sharp(resized).metadata();
    const rel = path.posix.join(baseKey, `${id}_${size}.jpg`);
    await writeFileToUploads(rel, resized);

    variants.push({
      size,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: resized.byteLength,
      path: rel,
      url: publicUrl(rel),
    });
  }

  return { id, original, variants };
}

export async function processManyImages(
  files: Express.Multer.File[],
  opts?: { max?: number; jpegQuality?: number }
): Promise<SavedImage[]> {
  const max = Math.max(1, Math.min(opts?.max ?? 8, 20));
  const items = files.slice(0, max);
  const out: SavedImage[] = [];
  for (const f of items) {
    out.push(await processImageBuffer(f.buffer, { jpegQuality: opts?.jpegQuality }));
  }
  return out;
}
