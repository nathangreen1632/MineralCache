import { Router } from 'express';
import { agree, myAgreements, getRequired } from '../../controllers/legal/legal.controller.js';

const router: Router = Router();

router.get('/required', getRequired);
router.get('/me', myAgreements);
router.post('/agree', agree);

export default router;
