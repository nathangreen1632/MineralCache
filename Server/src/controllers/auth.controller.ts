// Server/src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { Op, fn, col, where as sqlWhere } from 'sequelize'; // fn/col/where kept
import { User } from '../models/user.model.js';
import { loginSchema, registerSchema, verify18Schema, normalizeDob } from '../validation/auth.schema.js';

/** ------------------------------------------------------------------------
 * Error details serializer
 * -----------------------------------------------------------------------*/
function zDetails(err: ZodError) {
  const anyZ = z as any;
  if (typeof anyZ.treeifyError === 'function') return anyZ.treeifyError(err);
  return { formErrors: [err.message], fieldErrors: {} as Record<string, string[]> };
}

/** ------------------------------ Session helpers --------------------------- */
function rotateSession(req: Request): void {
  (req.session as any) = null;
}

function setSessionUser(
  req: Request,
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean; email?: string }
) {
  const sessionUser = { id: user.id, role: user.role, dobVerified18: user.dobVerified18, email: user.email };
  (req.session as any) = { user: sessionUser };
  req.user = sessionUser as any;
}

/** ------------------------------ Helpers --------------------------- */
function isAdult(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map((s) => Number(s));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const dob = new Date(Date.UTC(y, m - 1, d));
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() + 1 !== m || dob.getUTCDate() !== d) return false;

  const now = new Date();
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth() + 1;
  const nowD = now.getUTCDate();

  let age = nowY - y;
  if (nowM < m || (nowM === m && nowD < d)) age -= 1;
  return age >= 18;
}

// ---------- Handlers
export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }
  const { email, password, name } = parsed.data;

  const normEmail = email.trim().toLowerCase();

  const existing = await User.findOne({ where: { email: { [Op.iLike]: normEmail } } });
  if (existing) {
    res.status(409).json({ error: 'Email in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const user = await User.create({
    email: normEmail,
    passwordHash,
    role: 'buyer',
    dobVerified18: false,
    name,
    createdAt: now,
    updatedAt: now,
  } as any);

  rotateSession(req);
  setSessionUser(req, {
    id: Number(user.id),
    role: user.role as any,
    dobVerified18: Boolean(user.dobVerified18),
    email: user.email,
  });

  res.status(201).json({ id: Number(user.id), email: user.email });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }
  const { email, password } = parsed.data;
  const normEmail = email.trim().toLowerCase();

  // Case-insensitive equality via LOWER(email) = normEmail; no null-hash filter (we check below)
  const whereEmailEq = sqlWhere(fn('lower', col('email')), normEmail);
  const user = await User.findOne({

    where: whereEmailEq as any,
    attributes: ['id', 'email', 'role', 'dobVerified18', 'passwordHash', 'updatedAt', 'createdAt'],
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const hash = (user as any).passwordHash as string | null;
  let pass = !!hash && (await bcrypt.compare(password, hash));

  // Dev-only escape hatch (ignored in production)
  if (!pass && process.env.NODE_ENV !== 'production') {
    const allowDev = String(process.env.ALLOW_DEV_ADMIN_LOGIN ?? '').toLowerCase() === 'true';
    const devEmail = String(process.env.ADMIN_DEV_EMAIL ?? 'admin@mineralcache.local').toLowerCase();
    const devPass = String(process.env.ADMIN_DEV_PASSWORD ?? 'Admin123!');
    if (allowDev && normEmail === devEmail && password === devPass) {
      pass = true;
    }
  }

  if (!pass) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  rotateSession(req);
  setSessionUser(req, {
    id: Number(user.id),
    role: user.role as any,
    dobVerified18: Boolean(user.dobVerified18),
    email: user.email,
  });

  res.status(200).json({ ok: true });
}

/**
 * /auth/me — returns a stable shape for gating UI:
 * { id, email, role, vendorId?, dobVerified18, createdAt }
 */
export async function me(req: Request, res: Response): Promise<void> {
  const sess = (req.session as any)?.user;
  if (!sess?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await User.findByPk(sess.id, {
    attributes: ['id', 'email', 'role', 'vendorId', 'dobVerified18', 'createdAt'],
  });

  if (!user) {
    (req.session as any) = null;
    req.user = null as any;
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const base = {
    id: Number(user.id),
    email: String(user.email),
    role: user.role,
    dobVerified18: Boolean((user as any).dobVerified18),
    createdAt:
      (user as any).createdAt instanceof Date
        ? (user as any).createdAt.toISOString()
        : new Date(String((user as any).createdAt)).toISOString(),
  };

  const payload =
    (user as any).vendorId != null
      ? { ...base, vendorId: Number((user as any).vendorId) }
      : base;

  res.json(payload);
}

/**
 * /auth/verify-18 — uses your verify18Schema and DOB normalizer
 */
export async function verify18(req: Request, res: Response): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = verify18Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }

  const ymd = normalizeDob(parsed.data);
  if (!ymd) {
    res.status(400).json({ error: 'INVALID_DOB' });
    return;
  }
  if (!isAdult(ymd)) {
    res.status(400).json({ error: 'AGE_RESTRICTION' });
    return;
  }

  await User.update({ dobVerified18: true }, { where: { id: u.id } });

  u.dobVerified18 = true;
  (req.session as any) = { user: u };
  req.user = u;

  res.json({ ok: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  (req.session as any) = null;
  req.user = null as any;
  res.status(204).end();
}
