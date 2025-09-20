import { Router } from 'express';
import { register, login, me, verify18, logout } from '../controllers/auth.controller.js';

const router: Router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/verify-18', verify18);
router.post('/logout', logout);

export default router;
