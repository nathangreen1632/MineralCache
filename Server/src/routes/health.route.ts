// Server/src/routes/health.route.ts
import { Router } from 'express';
import { health } from '../controllers/health.controller.js';

const router: Router = Router();

router.get('/', health);

export default router;
