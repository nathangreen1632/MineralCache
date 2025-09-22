// Server/src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User } from '../models/user.model.js';

/** ------------------------------------------------------------------------
 * Email schema (no deprecated chain methods)
 * - Prefer Zod v4 top-level z.email(); fallback to string+refine on older Zod.
 * -----------------------------------------------------------------------*/
const EmailSchema =
  typeof (z as any).email === 'function'
    ? (z as any).email().max(320)
    : z
      .string()
      .max(320)
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Invalid email' });

const RegisterSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(200),
  dobVerified18: z.boolean().optional(),
});

const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(200),
});

/** ------------------------------------------------------------------------
 * Error details serializer (no deprecated .flatten() / .format())
 * - Zod v4: use z.treeifyError(err)
 * - Older Zod: fall back to minimal stable shape
 * -----------------------------------------------------------------------*/
function zDetails(err: ZodError) {
  const anyZ = z as any;
  if (typeof anyZ.treeifyError === 'function') {
    return anyZ.treeifyError(err);
  }
  return { formErrors: [err.message], fieldErrors: {} as Record<string, string[]> };
}

/** ------------------------------ Session helpers --------------------------- */
function rotateSession(req: Request): void {
  // With cookie-session, setting to null clears existing cookie/session.
  (req.session as any) = null;
}

/** Always assigns a fresh session object to avoid mutating a possibly-null value. */
function setSessionUser(
  req: Request,
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean; email?: string }
) {
  const sessionUser = {
    id: user.id,
    role: user.role,
    dobVerified18: user.dobVerified18,
    email: user.email,
  };
  (req.session as any) = { user: sessionUser };
  req.user = sessionUser as any;
}

// ---------- Handlers
export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }
  const { email, password, dobVerified18 } = parsed.data;

  // Normalize email
  const normEmail = email.trim().toLowerCase();

  // Uniqueness check (case-insensitive)
  const existing = await User.findOne({ where: { email: { [Op.iLike]: normEmail } } });
  if (existing) {
    res.status(409).json({ error: 'Email in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // createdAt/updatedAt included if your model doesn't mark CreationOptional
  const now = new Date();
  const user = await User.create({
    email: normEmail,
    passwordHash,
    role: 'buyer',
    dobVerified18: Boolean(dobVerified18),
    createdAt: now,
    updatedAt: now,
  } as any);

  // Anti-fixation: rotate then issue fresh session
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
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }
  const { email, password } = parsed.data;
  const normEmail = email.trim().toLowerCase();

  const user = await User.findOne({ where: { email: { [Op.iLike]: normEmail } } });
  if (!user) {
    // Generic to avoid credential oracle; aligns with backoff guard
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const ok = await bcrypt.compare(password, (user as any).passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Anti-fixation: destroy any pre-login cookie and issue a fresh one
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

  // Fetch fresh from DB to include vendorId + createdAt (ensure session isn't stale)
  const user = await User.findByPk(sess.id, {
    attributes: ['id', 'email', 'role', 'vendorId', 'dobVerified18', 'createdAt'],
  });

  if (!user) {
    // Stale session: clear and force re-login
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

  // Include vendorId only if present (optional field)
  const payload =
    (user as any).vendorId != null
      ? { ...base, vendorId: Number((user as any).vendorId) }
      : base;

  res.json(payload);
}

export async function verify18(req: Request, res: Response): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await User.update({ dobVerified18: true }, { where: { id: u.id } });

  u.dobVerified18 = true;
  (req.session as any) = { user: u };
  req.user = u;

  res.json({ ok: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Clear cookie-session state and return 204 No Content
  (req.session as any) = null;
  req.user = null as any;
  res.status(204).end();
}
