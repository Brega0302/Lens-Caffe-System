import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { listInventory, getInventoryItem, createInventoryItem, updateInventoryItem, updateInventoryStatus, adjustInventory, listMovements, listCategories } from '../controllers/lensOSController.js';

const router = express.Router();
router.get('/', requirePermission('inventory:read'), listInventory);
router.get('/categories', requirePermission('inventory:read'), listCategories);
router.get('/:id/movements', requirePermission('inventory:read'), listMovements);
router.get('/:id', requirePermission('inventory:read'), getInventoryItem);
router.post('/', requirePermission('inventory:write'), createInventoryItem);
router.patch('/:id', requirePermission('inventory:write'), updateInventoryItem);
router.patch('/:id/status', requirePermission('inventory:write'), updateInventoryStatus);
router.post('/:id/adjustments', requirePermission('inventory:write'), adjustInventory);
export default router;
