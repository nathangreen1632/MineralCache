import type { Request, Response } from 'express';
import { z } from 'zod';
import { UserAgreement } from '../../models/userAgreement.model.js';

const requiredDocs = [
  { key: 'tos', title: 'Terms of Service', file: 'terms-of-service.html', version: '2025-10-15' },
  { key: 'privacy', title: 'Privacy Policy', file: 'privacy-policy.html', version: '2025-10-15' },
  { key: 'cookie', title: 'Cookie Policy', file: 'cookie-policy.html', version: '2025-10-15' },
  { key: 'eula', title: 'EULA', file: 'eula.html', version: '2025-10-15' },
];

const agreeSchema = z.object({
  documentType: z.string().min(1).max(64),
  version: z.string().min(1).max(32),
});

export async function getRequired(req: Request, res: Response) {
  res.json({ ok: true, docs: requiredDocs });
}

export async function myAgreements(req: Request, res: Response) {
  const u = (req as any).user ?? null;
  if (!u?.id) {
    res.status(401).json({ ok: false, code: 'AUTH_REQUIRED' });
    return;
  }
  const rows = await UserAgreement.findAll({ where: { userId: u.id }, order: [['acceptedAt', 'DESC']] });
  res.json({
    ok: true,
    agreements: rows.map((r) => ({
      documentType: r.documentType,
      version: r.version,
      acceptedAt: r.acceptedAt,
    })),
  });
}

export async function agree(req: Request, res: Response) {
  const u = (req as any).user ?? null;
  if (!u?.id) {
    res.status(401).json({ ok: false, code: 'AUTH_REQUIRED' });
    return;
  }
  const p = agreeSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ ok: false, code: 'VALIDATION_FAILED', errors: p.error.issues });
    return;
  }
  const { documentType, version } = p.data;
  await UserAgreement.findOrCreate({
    where: { userId: u.id, documentType, version },
    defaults: { userId: u.id, documentType, version, acceptedAt: new Date() },
  });
  res.json({ ok: true });
}
