// Server/src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User } from '../models/user.model.js';

/** ------------------------------------------------------------------------
 * Email schema (no deprecated .email() method)
 * - Use z.email() if present (newer Zod).
 * - Otherwise, use string + refine with a reasonable pattern (no deprecations).
 * -----------------------------------------------------------------------*/
const EmailSchema: z.ZodString = (typeof (z as any).email === 'function')
  ? (z as any).email()
  : z
    .string()
    .refine(
      (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: 'Invalid email' }
    );

const RegisterSchema = z.object({
  email: EmailSchema.max(320),
  password: z.string().min(8).max(200),
  dobVerified18: z.boolean().optional(),
});

const LoginSchema = z.object({
  email: EmailSchema.max(320),
  password: z.string().min(8).max(200),
});

/** ------------------------------------------------------------------------
 * Error details serializer (no deprecated .flatten())
 * Pref: z.treeifyError (new) → err.format() → minimal fallback
 * -----------------------------------------------------------------------*/
function zDetails(err: ZodError) {
  const anyZ = z as any;
  if (typeof anyZ.treeifyError === 'function') return anyZ.treeifyError(err);
  if (typeof (err as any).format === 'function') return (err as any).format();
  // minimal fallback to keep a stable shape
  return { formErrors: [err.message], fieldErrors: {} as Record<string, string[]> };
}

function setSessionUser(
  req: Request,
  user: { id: number; role: 'buyer' | 'vendor' | 'admin'; dobVerified18: boolean; email?: string }
) {
  (req.session as any).user = {
    id: user.id,
    role: user.role,
    dobVerified18: user.dobVerified18,
    email: user.email,
  };
  req.user = (req.session as any).user;
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
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const ok = await bcrypt.compare(password, (user as any).passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  setSessionUser(req, {
    id: Number(user.id),
    role: user.role as any,
    dobVerified18: Boolean(user.dobVerified18),
    email: user.email,
  });

  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const u = (req.session as any)?.user ?? null;
  res.json({ user: u });
}

export async function verify18(req: Request, res: Response): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await User.update({ dobVerified18: true }, { where: { id: u.id } });

  u.dobVerified18 = true;
  (req.session as any).user = u;
  req.user = u;

  res.json({ ok: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  (req.session as any).user = null;
  req.user = null as any;
  res.json({ ok: true });
}
