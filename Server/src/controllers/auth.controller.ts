// Server/src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { z, type ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { Op, fn, col, where as sqlWhere } from 'sequelize';
import { User } from '../models/user.model.js';
import { PasswordReset } from '../models/passwordReset.model.js';
import {
  loginSchema,
  registerSchema,
  verify18Schema,
  normalizeDob,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validation/auth.schema.js';
import { logInfo, logWarn } from '../services/log.service.js';
import crypto from 'node:crypto';
import { sendOtpEmail } from '../services/email.service.js';

function zDetails(err: ZodError) {
  const anyZ = z as any;
  if (typeof anyZ.treeifyError === 'function') return anyZ.treeifyError(err);
  return { formErrors: [err.message], fieldErrors: {} as Record<string, string[]> };
}

function obsCtx(req: Request) {
  const ctx = (req as any).context || {};
  const u = (req as any).user ?? (req.session as any)?.user ?? null;
  return { requestId: ctx.requestId, userId: u?.id ?? null, ip: req.ip };
}

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

function genOtp6(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    logWarn('auth.register.invalid_input', { ...obsCtx(req) });
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }
  const { email, password, name } = parsed.data;

  const normEmail = email.trim().toLowerCase();

  const existing = await User.findOne({ where: { email: { [Op.iLike]: normEmail } } });
  if (existing) {
    logWarn('auth.register.email_in_use', { ...obsCtx(req) });
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

  logInfo('auth.register.created', { ...obsCtx(req), newUserId: Number(user.id) });

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
    logWarn('auth.login.invalid_input', { ...obsCtx(req) });
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }
  const { email, password } = parsed.data;
  const normEmail = email.trim().toLowerCase();

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
    logWarn('auth.login.user_not_found', { ...obsCtx(req) });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const hash = (user as any).passwordHash as string | null;
  let pass = !!hash && (await bcrypt.compare(password, hash));

  if (!pass && process.env.NODE_ENV !== 'production') {
    const allowDev = String(process.env.ALLOW_DEV_ADMIN_LOGIN ?? '').toLowerCase() === 'true';
    const devEmail = String(process.env.ADMIN_DEV_EMAIL ?? 'admin@mineralcache.local').toLowerCase();
    const devPass = String(process.env.ADMIN_DEV_PASSWORD ?? 'Admin123!');
    if (allowDev && normEmail === devEmail && password === devPass) {
      pass = true;
    }
  }

  if (!pass) {
    logWarn('auth.login.bad_password', { ...obsCtx(req), userId: Number(user.id) });
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

  logInfo('auth.login.success', { ...obsCtx(req), userId: Number(user.id) });
  res.status(200).json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const sess = (req.session as any)?.user;
  if (!sess?.id) {
    logWarn('auth.me.unauthorized', { ...obsCtx(req) });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await User.findByPk(sess.id, {
    attributes: ['id', 'email', 'role', 'vendorId', 'dobVerified18', 'createdAt'],
  });

  if (!user) {
    logWarn('auth.me.stale_session', { ...obsCtx(req), sessUserId: Number(sess.id) });
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

export async function verify18(req: Request, res: Response): Promise<void> {
  const u = (req.session as any)?.user;
  if (!u?.id) {
    logWarn('auth.verify18.unauthorized', { ...obsCtx(req) });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = verify18Schema.safeParse(req.body);
  if (!parsed.success) {
    logWarn('auth.verify18.invalid_input', { ...obsCtx(req), userId: Number(u.id) });
    res.status(400).json({ error: 'Invalid input', details: zDetails(parsed.error) });
    return;
  }

  const ymd = normalizeDob(parsed.data);
  if (!ymd) {
    logWarn('auth.verify18.invalid_dob', { ...obsCtx(req), userId: Number(u.id) });
    res.status(400).json({ error: 'INVALID_DOB' });
    return;
  }
  if (!isAdult(ymd)) {
    logWarn('auth.verify18.age_restriction', { ...obsCtx(req), userId: Number(u.id) });
    res.status(400).json({ error: 'AGE_RESTRICTION' });
    return;
  }

  await User.update({ dobVerified18: true }, { where: { id: u.id } });

  u.dobVerified18 = true;
  (req.session as any) = { user: u };
  req.user = u;

  logInfo('auth.verify18.verified', { ...obsCtx(req), userId: Number(u.id) });
  res.json({ ok: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const prevId = (req.session as any)?.user?.id ?? null;
  (req.session as any) = null;
  req.user = null as any;
  logInfo('auth.logout', { ...obsCtx(req), userId: prevId });
  res.status(204).end();
}

function lowerEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    logWarn('auth.forgot.invalid_input', { ...obsCtx(req) });
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  const email = lowerEmail(parsed.data.email);

  try {
    const user = await User.findOne({
      where: sqlWhere(fn('lower', col('email')), email),
      attributes: ['id', 'email'],
    });

    const code = genOtp6();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const ttlMs = 10 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    if (user) {
      await PasswordReset.create({ userId: Number(user.id), codeHash: hash, expiresAt } as any);
      try {
        await sendOtpEmail({ to: { email: user.email, name: null }, code, minutes: 10 });
      } catch {}
      logInfo('auth.forgot.issued', { ...obsCtx(req), userId: Number(user.id) });
    }

    res.json({ ok: true });
  } catch (e) {
    logWarn('auth.forgot.error', { ...obsCtx(req), msg: String((e as any)?.message || e) });
    res.json({ ok: true });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    logWarn('auth.reset.invalid_input', { ...obsCtx(req) });
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  const email = lowerEmail(parsed.data.email);
  const code = parsed.data.code;
  const newPassword = parsed.data.newPassword;

  try {
    const user = await User.findOne({
      where: sqlWhere(fn('lower', col('email')), email),
      attributes: ['id', 'email', 'passwordHash'],
    });
    if (!user) {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const token = await PasswordReset.findOne({
      where: {
        userId: Number(user.id),
        codeHash,
        usedAt: { [Op.is]: null },
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['id', 'DESC']],
    });

    if (!token) {
      res.status(400).json({ error: 'Invalid or expired code' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    await user.update({ passwordHash: hashed });
    await token.update({ usedAt: new Date() });

    logInfo('auth.reset.success', { ...obsCtx(req), userId: Number(user.id) });
    res.json({ ok: true });
  } catch (e) {
    logWarn('auth.reset.error', { ...obsCtx(req), msg: String((e as any)?.message || e) });
    res.status(500).json({ error: 'Failed to reset password' });
  }
}
