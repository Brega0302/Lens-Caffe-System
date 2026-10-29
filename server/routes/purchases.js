import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { listPurchases, getPurchase, createPurchase } from '../controllers/lensOSController.js';

const router = express.Router();
router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/', requirePermission('purchases:write'), createPurchase);
export default router;
