import express from 'express';
import { dashboardSummary } from '../controllers/lensOSController.js';

const router = express.Router();
router.get('/summary', dashboardSummary);
export default router;
