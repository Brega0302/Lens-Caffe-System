import express from 'express';
import { 
  getAllPayments,
  getCandidatePayments,
  recordPayment
} from '../controllers/paymentController.js';

const router = express.Router();

router.get('/', getAllPayments);
router.get('/candidate/:candidateId', getCandidatePayments);
router.post('/', recordPayment);

export default router;
