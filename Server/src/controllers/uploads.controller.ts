// Server/src/controllers/uploads.controller.ts
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateAllImages } from '../services/mime.service.js';
import {
  processManyImages,
  processImageBuffer,
  type SavedImage,
} from '../services/image.service.js';
import {
  issueUploadTokens,
  verifyUploadToken,
  writeStagingFile,
  readStagingFile,
  removeStagingFile,
} from '../services/uploadToken.service.js';
import { logWarn } from '../services/log.service.js'; // ✅ NEW

// ✅ Small helper to include request/user context in safeguard logs
function ctx(req: Request) {
  const c = (req as any).context || {};
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  return { requestId: c.requestId, userId: c.userId ?? (u?.id ?? null) };
}

/**
 * Existing multipart upload (Multer) -> sharp pipeline
 */
export async function uploadPhotos(req: Request, res: Response): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      // ✅ Safeguard signal
      logWarn('upload.multipart.empty', { ...ctx(req) });
      res.status(400).json({ error: 'No files provided (expected field "photos")' });
      return;
    }

    // 1) Byte-level MIME validation (rejects disguised files)
    await validateAllImages(files);

    // 2) Generate original + 320/800/1600 derivatives
    const saved = await processManyImages(files, { max: 8 });

    res.status(201).json({ items: saved });
  } catch (e: any) {
    const msg = e?.message || 'Upload failed';
    const unsupported = /unsupported image type/i.test(msg);
    if (unsupported) {
      // ✅ Safeguard signal for MIME/type rejections
      logWarn('upload.mime.invalid', { ...ctx(req), error: msg });
    } else {
      // Soft warn for other multipart failures (keeps error logs clean)
      logWarn('upload.multipart.failed', { ...ctx(req), error: msg });
    }
    const code = unsupported ? 415 : 400;
    res.status(code).json({ error: msg });
  }
}

/**
 * 1) Issue signed URLs for direct uploads
 * POST /api/uploads/sign
 * body: { count?: number, mime?: string, maxBytes?: number, expiresInSec?: number }
 */
export async function signUploads(req: Request, res: Response): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    // ✅ Unauthorized attempts can be noisy, but useful to see
    logWarn('upload.sign.unauthorized', { ...ctx(req) });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const count = Number(req.body?.count ?? 1);
  const mime = typeof req.body?.mime === 'string' ? req.body.mime : 'image/jpeg';
  const maxBytes = Number(req.body?.maxBytes ?? 10 * 1024 * 1024);
  const expiresInSec = Number(req.body?.expiresInSec ?? 15 * 60);

  const tokens = issueUploadTokens({
    userId: Number(u.id),
    count,
    mime,
    maxBytes,
    expiresInSec,
  });

  res.json({ items: tokens });
}

/**
 * 2) Direct upload endpoint (raw body)
 * PUT /api/uploads/direct/:token
 * headers: Content-Type must match token.mime
 * body: raw bytes (Buffer)
 *
 * NOTE: The route must use express.raw() so req.body is a Buffer.
 */
export async function directUpload(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.params?.token || '');
    const v = verifyUploadToken(token);
    if (!v.ok) {
      logWarn('upload.direct.bad_token', { ...ctx(req), token });
      res.status(400).json({ error: v.error });
      return;
    }
    const { payload, absPath } = v;

    const ct = String(req.headers['content-type'] || '');
    if (ct.toLowerCase() !== String(payload.mime).toLowerCase()) {
      // ✅ Safeguard signal for mismatched content-type
      logWarn('upload.direct.content_type_mismatch', {
        ...ctx(req),
        token,
        received: ct,
        expected: payload.mime,
      });
      res.status(415).json({ error: 'Content-Type mismatch' });
      return;
    }

    // req.body is Buffer because the route uses express.raw()
    const buf = (req as any).body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      logWarn('upload.direct.empty_body', { ...ctx(req), token });
      res.status(400).json({ error: 'Empty body' });
      return;
    }
    if (buf.length > payload.max) {
      logWarn('upload.direct.too_large', {
        ...ctx(req),
        token,
        size: buf.length,
        max: payload.max,
      });
      res.status(413).json({ error: `File too large (max ${payload.max} bytes)` });
      return;
    }

    await writeStagingFile(absPath, buf);
    res.status(201).json({ ok: true, bytes: buf.length });
  } catch (e: any) {
    // Keep as 500; verification failures above already produce 400/415 with warn logs
    res.status(500).json({ error: 'Upload failed', detail: e?.message });
  }
}

/**
 * 3) Finalize staged uploads -> sharp derivatives
 * POST /api/uploads/finalize
 * body: { tokens: string[] }
 */
export async function finalizeUploads(req: Request, res: Response): Promise<void> {
  try {
    const u = (req.session as any)?.user;
    if (!u?.id) {
      logWarn('upload.finalize.unauthorized', { ...ctx(req) });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tokens: string[] = Array.isArray(req.body?.tokens) ? req.body.tokens : [];
    if (tokens.length === 0) {
      logWarn('upload.finalize.no_tokens', { ...ctx(req) });
      res.status(400).json({ error: 'No tokens provided' });
      return;
    }

    const out: Array<{ token: string; saved?: SavedImage; error?: string }> = [];

    for (const token of tokens) {
      const v = verifyUploadToken(String(token || ''));
      if (!v.ok) {
        logWarn('upload.finalize.bad_token', { ...ctx(req), token });
        out.push({ token, error: v.error });
        continue;
      }
      try {
        const buf = await readStagingFile(v.absPath);
        const saved = await processImageBuffer(buf);
        await removeStagingFile(v.absPath);
        out.push({ token, saved });
      } catch (err: any) {
        logWarn('upload.finalize.error', { ...ctx(req), token, error: err?.message });
        out.push({ token, error: err?.message || 'Finalize failed' });
      }
    }

    res.json({ items: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Finalize error', detail: e?.message });
  }
}

/**
 * 4) Maintenance: purge staged uploads older than N hours (with safety margin)
 * POST /api/uploads/staging/purge?hours=24&safetyHours=1
 * (Route should be admin-protected.)
 */
export async function purgeStagingUploads(req: Request, res: Response): Promise<void> {
  try {
    const hours = Number(req.query.hours ?? 24);
    const safetyHours = Number(req.query.safetyHours ?? 1);

    if (!Number.isFinite(hours) || hours <= 0) {
      res.status(400).json({ error: 'Invalid hours' });
      return;
    }
    if (!Number.isFinite(safetyHours) || safetyHours < 0) {
      res.status(400).json({ error: 'Invalid safetyHours' });
      return;
    }

    const UPLOADS_DIR = (process.env.UPLOADS_DIR || '/var/data/uploads').trim();
    const STAGING_DIR = path.resolve(UPLOADS_DIR, 'staging');

    // Walk recursively
    async function* walk(dir: string): AsyncGenerator<string> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          yield* walk(full);
        } else if (e.isFile()) {
          yield full;
        }
      }
    }

    const now = Date.now();
    const olderThanMs = hours * 3_600_000;
    const safetyMs = safetyHours * 3_600_000;

    let filesChecked = 0;
    let filesDeleted = 0;
    let bytesFreed = 0;

    try {
      await fs.access(STAGING_DIR);
    } catch {
      res.json({ ok: true, stagingExists: false, filesChecked, filesDeleted, bytesFreed });
      return;
    }

    for await (const file of walk(STAGING_DIR)) {
      filesChecked += 1;
      const st = await fs.stat(file);
      const ageMs = now - st.mtimeMs;

      // Must be older than threshold + safety margin
      if (ageMs > olderThanMs + safetyMs) {
        filesDeleted += 1;
        bytesFreed += st.size;
        try {
          await fs.rm(file, { force: true });
        } catch {
          // ignore individual file errors; continue
        }
      }
    }

    res.json({
      ok: true,
      stagingExists: true,
      hours,
      safetyHours,
      filesChecked,
      filesDeleted,
      bytesFreed,
    });
  } catch (e: any) {
    const msg = e?.message || 'Failed to purge staging uploads';
    res.status(500).json({ error: msg });
  }
}
