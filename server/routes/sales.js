import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { listSales, getSale, createSale } from '../controllers/lensOSController.js';

const router = express.Router();
router.get('/', listSales);
router.get('/:id', getSale);
router.post('/', requirePermission('sales:write'), createSale);
export default router;
