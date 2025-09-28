// Server/src/controllers/admin/shippingRules.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { ShippingRule } from '../../models/shippingRule.model.js';
import { validateDefinedNumber } from '../../utils/validate.util.js';
import { computeVendorShipping, chooseRuleForVendor } from '../../services/shipping.service.js';

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = req.query.vendorId ? toInt(req.query.vendorId, -1) : null;
    const active = typeof req.query.active === 'string' ? req.query.active === 'true' : undefined;
    const page = toInt(req.query.page, 1);
    const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 25), 1), 200);

    const where: any = {};
    if (vendorId === -1) {
      where.vendorId = null;
    } else if (typeof vendorId === 'number' && vendorId > 0) {
      where.vendorId = vendorId;
    }
    if (typeof active === 'boolean') {
      where.active = active;
    }

    const offset = (page - 1) * pageSize;
    const result = await ShippingRule.findAndCountAll({
      where,
      order: [
        ['vendorId', 'ASC'],
        ['isDefaultGlobal', 'DESC'],
        ['active', 'DESC'],
        ['priority', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: pageSize,
      offset,
    });

    res.json({
      items: result.rows,
      total: result.count,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body;

    // Enforce only one global default at a time (when vendorId is null)
    if (body.isDefaultGlobal === true) {
      await ShippingRule.update(
        { isDefaultGlobal: false },
        { where: { vendorId: null, isDefaultGlobal: true } }
      );
    }

    const created = await ShippingRule.create({
      vendorId: body.vendorId ?? null,
      label: String(body.label ?? 'Shipping'),
      baseCents: Number(body.baseCents ?? 0),
      perItemCents: Number(body.perItemCents ?? 0),
      perWeightCents: Number(body.perWeightCents ?? 0),
      minCents: typeof body.minCents === 'number' ? body.minCents : null,
      maxCents: typeof body.maxCents === 'number' ? body.maxCents : null,
      freeThresholdCents: typeof body.freeThresholdCents === 'number' ? body.freeThresholdCents : null,
      priority: Number(body.priority ?? 100),
      active: body.active === undefined ? true : Boolean(body.active),
      isDefaultGlobal: Boolean(body.isDefaultGlobal ?? false),
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateDefinedNumber(req.params.id, 'id');
    const rule = await ShippingRule.findByPk(id);
    if (!rule) {
      res.status(404).json({ error: 'Shipping rule not found' });
      return;
    }

    const body = req.body;

    if (body.isDefaultGlobal === true && rule.vendorId == null) {
      await ShippingRule.update(
        { isDefaultGlobal: false },
        { where: { vendorId: null, isDefaultGlobal: true, id: { [Op.ne]: id } } }
      );
    }

    const updates: any = {};

    if (body.vendorId !== undefined) updates.vendorId = body.vendorId ?? null;
    if (body.label !== undefined) updates.label = String(body.label);
    if (body.baseCents !== undefined) updates.baseCents = Number(body.baseCents);
    if (body.perItemCents !== undefined) updates.perItemCents = Number(body.perItemCents);
    if (body.perWeightCents !== undefined) updates.perWeightCents = Number(body.perWeightCents);
    if (body.minCents !== undefined) updates.minCents = typeof body.minCents === 'number' ? body.minCents : null;
    if (body.maxCents !== undefined) updates.maxCents = typeof body.maxCents === 'number' ? body.maxCents : null;
    if (body.freeThresholdCents !== undefined) {
      updates.freeThresholdCents = typeof body.freeThresholdCents === 'number' ? body.freeThresholdCents : null;
    }
    if (body.priority !== undefined) updates.priority = Number(body.priority);
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.isDefaultGlobal !== undefined) updates.isDefaultGlobal = Boolean(body.isDefaultGlobal);

    await rule.update(updates);

    res.json(rule);
  } catch (err) {
    next(err);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateDefinedNumber(req.params.id, 'id');
    const rule = await ShippingRule.findByPk(id);
    if (!rule) {
      res.status(404).json({ error: 'Shipping rule not found' });
      return;
    }
    await rule.update({ active: true });
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateDefinedNumber(req.params.id, 'id');
    const rule = await ShippingRule.findByPk(id);
    if (!rule) {
      res.status(404).json({ error: 'Shipping rule not found' });
      return;
    }
    await rule.update({ active: false });
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

export async function setDefaultGlobal(req: Request, res: Response, next: NextFunction) {
  try {
    const id = validateDefinedNumber(req.params.id, 'id');
    const rule = await ShippingRule.findByPk(id);
    if (!rule) {
      res.status(404).json({ error: 'Shipping rule not found' });
      return;
    }
    if (rule.vendorId !== null) {
      res.status(400).json({ error: 'Only global rules (vendorId null) can be default' });
      return;
    }

    await ShippingRule.update({ isDefaultGlobal: false }, { where: { vendorId: null, isDefaultGlobal: true } });
    await rule.update({ isDefaultGlobal: true, active: true });

    res.json(rule);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/shipping-rules/preview?vendorId=&subtotalCents=&itemCount= */
export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = toInt(req.query.vendorId, 0);
    const subtotalCents = Math.max(0, toInt(req.query.subtotalCents, 0));
    const itemCount = Math.max(0, toInt(req.query.itemCount, 0));

    const applied = await computeVendorShipping({ vendorId, subtotalCents, itemCount });
    res.json(applied);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/shipping-rules/active?vendorId= */
export async function activeForVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = toInt(req.query.vendorId, 0);
    if (vendorId <= 0) {
      res.status(400).json({ error: 'vendorId is required' });
      return;
    }
    const rule = await chooseRuleForVendor(vendorId);
    if (!rule) {
      res.status(404).json({ error: 'No active rule for vendor' });
      return;
    }
    res.json(rule);
  } catch (err) {
    next(err);
  }
}
