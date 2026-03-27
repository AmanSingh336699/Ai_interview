import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import * as controller from './user.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/profile', controller.getProfile);
router.patch('/profile', controller.updateProfile);
router.get('/analytics', controller.getAnalytics);
router.get('/dashboard', controller.getDashboard);

export default router;
