import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware.js';
import { createShippingRuleSchema, updateShippingRuleSchema } from '../../validation/shippingRules.schema.js';
import { list, create, update, activate, deactivate, setDefaultGlobal, preview, activeForVendor } from '../../controllers/admin/shippingRules.controller.js';

export const shippingRulesRouter: Router = Router();

// GET /api/admin/shipping-rules
shippingRulesRouter.get('/', list);

// GET /api/admin/shipping-rules/preview?vendorId=&subtotalCents=&itemCount=
shippingRulesRouter.get('/preview', preview);

// GET /api/admin/shipping-rules/active?vendorId=
shippingRulesRouter.get('/active', activeForVendor);

// POST /api/admin/shipping-rules
shippingRulesRouter.post('/', validateBody(createShippingRuleSchema), create);

// PATCH /api/admin/shipping-rules/:id
shippingRulesRouter.patch('/:id', validateBody(updateShippingRuleSchema), update);

// POST /api/admin/shipping-rules/:id/activate
shippingRulesRouter.post('/:id/activate', activate);

// POST /api/admin/shipping-rules/:id/deactivate
shippingRulesRouter.post('/:id/deactivate', deactivate);

// POST /api/admin/shipping-rules/:id/set-default
shippingRulesRouter.post('/:id/set-default', setDefaultGlobal);
