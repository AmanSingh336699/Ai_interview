import { logger } from '../config/logger.js';
import * as interviewService from '../modules/interview/interview.service.js';

export function setupInterviewHandlers(io, socket) {
    socket.on('interview:join_session', async ({ sessionId }) => {
    try {
      
      const session = await interviewService.getSession(sessionId, socket.userId);
      socket.join(`interview:${sessionId}`);
      logger.info(`User ${socket.userId} joined interview room: ${sessionId}`);

      socket.emit('interview:auto_saved', { savedAt: new Date().toISOString() });
    } catch (error) {
      socket.emit('interview:error', {
        code: 'JOIN_FAILED',
        message: error.message,
        recoverable: true,
      });
    }
  });

    socket.on('interview:submit_answer', async ({ sessionId, roundId, questionId, answer, codeAnswer, language }) => {
    try {
      
      socket.emit('interview:ai_thinking', { message: 'AI is evaluating your answer...' });

      const result = await interviewService.submitAnswer(
        { sessionId, roundId, questionId, answer, codeAnswer, language },
        socket.userId
      );

      socket.emit('interview:evaluation_done', {
        evaluation: result.evaluation,
        score: result.evaluation?.totalScore || 0,
        feedback: result.evaluation?.positiveFeedback || result.evaluation?.verdict || '',
        nextAction: 'continue',
      });
    } catch (error) {
      logger.error(`Socket answer submit error: ${error.message}`);
      socket.emit('interview:error', {
        code: 'EVAL_FAILED',
        message: 'AI evaluation failed. Please try again.',
        recoverable: true,
      });
    }
  });

    socket.on('interview:request_hint', async ({ sessionId, questionId }) => {
    try {
      const result = await interviewService.getHint(questionId, socket.userId, socket.user?.plan || 'FREE', socket.user?.isAdmin || false);
      socket.emit('interview:hint_ready', {
        hint: result.hint,
        hintsRemaining: result.hintsRemaining,
      });
    } catch (error) {
      socket.emit('interview:error', {
        code: 'HINT_FAILED',
        message: error.message,
        recoverable: true,
      });
    }
  });

    socket.on('interview:skip_question', async ({ sessionId, questionId }) => {
    try {
      await interviewService.skipQuestion(questionId, socket.userId);
      socket.emit('interview:evaluation_done', {
        evaluation: null,
        score: 0,
        feedback: 'Question skipped',
        nextAction: 'next_question',
      });
    } catch (error) {
      socket.emit('interview:error', {
        code: 'SKIP_FAILED',
        message: error.message,
        recoverable: true,
      });
    }
  });

    socket.on('interview:pause_session', async ({ sessionId }) => {
    try {
      await interviewService.updateSessionStatus(sessionId, socket.userId, 'PAUSED');
      socket.emit('interview:auto_saved', { savedAt: new Date().toISOString() });
    } catch (error) {
      socket.emit('interview:error', {
        code: 'PAUSE_FAILED',
        message: error.message,
        recoverable: true,
      });
    }
  });

    socket.on('interview:resume_session', async ({ sessionId }) => {
    try {
      await interviewService.updateSessionStatus(sessionId, socket.userId, 'IN_PROGRESS');
      socket.emit('interview:auto_saved', { savedAt: new Date().toISOString() });
    } catch (error) {
      socket.emit('interview:error', {
        code: 'RESUME_FAILED',
        message: error.message,
        recoverable: true,
      });
    }
  });

    socket.on('interview:heartbeat', ({ sessionId, timestamp }) => {
    socket.emit('interview:auto_saved', { savedAt: timestamp });
  });
}
