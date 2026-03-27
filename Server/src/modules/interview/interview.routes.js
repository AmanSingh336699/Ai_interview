import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { answerLimiter, hintLimiter } from '../../middleware/rateLimit.middleware.js';
import {
  createSessionSchema,
  startRoundSchema,
  submitAnswerSchema,
  skipQuestionSchema,
  completeRoundSchema,
  completeSessionSchema,
  updateSessionSchema,
  historyQuerySchema,
} from './interview.schema.js';
import * as controller from './interview.controller.js';

const router = Router();


router.use(requireAuth);


router.post('/session', validate(createSessionSchema), controller.createSession);
router.get('/session/:id', controller.getSession);
router.patch('/session/:id', validate(updateSessionSchema), controller.updateSession);
router.delete('/session/:id', controller.deleteSession);


router.post('/round/start', validate(startRoundSchema), controller.startRound);
router.post('/round/complete', validate(completeRoundSchema), controller.completeRound);


router.post('/answer', answerLimiter, validate(submitAnswerSchema), controller.submitAnswer);
router.get('/hint/:questionId', hintLimiter, controller.getHint);
router.post('/skip', validate(skipQuestionSchema), controller.skipQuestion);


router.post('/complete', validate(completeSessionSchema), controller.completeSessionCtrl);
router.get('/results/:sessionId', controller.getResults);
router.get('/history', validate(historyQuerySchema, 'query'), controller.getHistory);

export default router;
