// Server/src/services/upload-token.service.ts
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SECRET = (process.env.UPLOAD_SIGNING_SECRET || 'dev-upload-secret').trim();
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/data/uploads';
const STAGING_DIR = path.resolve(UPLOADS_DIR, 'staging');

type TokenPayloadV1 = {
  v: 1;
  uid: number;         // user id
  key: string;         // relative staging path (e.g. staging/2025/09/uuid.bin)
  mime: string;        // expected content-type, e.g. image/jpeg
  max: number;         // max bytes
  exp: number;         // unix seconds expiry
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: object): string {
  const json = JSON.stringify(payload);
  const body = b64url(json);
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return `${body}.${sig}`;
}

function verify<T = any>(token: string): { ok: true; payload: T } | { ok: false; error: string } {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'bad token format' };
  const [body, sig] = parts;
  const expect = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) {
    return { ok: false, error: 'bad signature' };
  }
  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf8'));
    return { ok: true, payload };
  } catch {
    return { ok: false, error: 'bad payload' };
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function datedStagingKey(): string {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID().replace(/-/g, '');
  return path.posix.join('staging', yyyy, mm, `${id}.bin`);
}

export function issueUploadTokens(args: {
  userId: number;
  count?: number;
  mime?: string;
  maxBytes?: number;
  expiresInSec?: number;
}) {
  const {
    userId,
    count = 1,
    mime = 'application/octet-stream',
    maxBytes = 10 * 1024 * 1024,  // 10MB default
    expiresInSec = 15 * 60,       // 15 minutes
  } = args;

  const n = Math.max(1, Math.min(count, 8));
  const exp = nowSec() + Math.max(60, Math.min(expiresInSec, 24 * 3600));
  const items = [];

  for (let i = 0; i < n; i++) {
    const key = datedStagingKey(); // e.g. staging/2025/09/abcdef.bin
    const payload: TokenPayloadV1 = { v: 1, uid: userId, key, mime, max: maxBytes, exp };
    const token = sign(payload);
    items.push({
      token,
      method: 'PUT' as const,
      url: `/api/uploads/direct/${token}`,
      headers: { 'Content-Type': mime },
      expiresAt: exp,
      maxBytes,
      key,
    });
  }
  return items;
}

export function verifyUploadToken(token: string) {
  const v = verify<TokenPayloadV1>(token);
  if (!v.ok) return v;
  const p = v.payload;
  if (p.v !== 1) return { ok: false as const, error: 'version mismatch' };
  if (!p.key) {
    return { ok: false as const, error: 'invalid payload' };
  }
  if (p.exp < nowSec()) return { ok: false as const, error: 'expired' };

  // Prevent path traversal; enforce under /staging
  const rel = p.key.replaceAll('\\', '/');
  if (!rel.startsWith('staging/')) return { ok: false as const, error: 'bad key' };

  const abs = path.resolve(UPLOADS_DIR, rel);
  if (!abs.startsWith(path.resolve(UPLOADS_DIR))) {
    return { ok: false as const, error: 'bad path' };
  }
  return { ok: true as const, payload: p, absPath: abs, relPath: rel };
}

export async function writeStagingFile(absPath: string, buf: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buf, { flag: 'w' });
}

export async function readStagingFile(absPath: string): Promise<Buffer> {
  return fs.readFile(absPath);
}

export async function removeStagingFile(absPath: string): Promise<void> {
  try { await fs.unlink(absPath); } catch { /* ignore */ }
}

export { STAGING_DIR, UPLOADS_DIR };
