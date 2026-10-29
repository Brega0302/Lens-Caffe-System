import express from 'express';
import { 
  getCandidateLessons,
  logLesson
} from '../controllers/lessonController.js';

const router = express.Router();

router.get('/candidate/:candidateId', getCandidateLessons);
router.post('/', logLesson);

export default router;
