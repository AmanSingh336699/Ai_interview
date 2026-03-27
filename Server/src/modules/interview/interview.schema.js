import { z } from 'zod';

export const createSessionSchema = z.object({
  level: z.enum(['SDE_1', 'SDE_2', 'SDE_3', 'SDE_4']),
  role: z.enum(['FRONTEND', 'BACKEND', 'FULL_STACK', 'DEVOPS', 'MOBILE']),
  companyType: z.enum(['FAANG', 'STARTUP', 'MNC', 'FINTECH', 'PRODUCT']),
  companyName: z.string().max(100).optional(),
});

export const startRoundSchema = z.object({
  sessionId: z.string().min(1),
  roundNumber: z.coerce.number().int().min(1),
});

export const submitAnswerSchema = z.object({
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  questionId: z.string().min(1),
  answer: z.string().max(50000).optional(),
  codeAnswer: z.string().max(15000).optional(),
  language: z.string().max(20).optional(),
});

export const skipQuestionSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
});

export const completeRoundSchema = z.object({
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
});

export const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const updateSessionSchema = z.object({
  status: z.enum(['PAUSED', 'ABANDONED']),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  level: z.enum(['SDE_1', 'SDE_2', 'SDE_3', 'SDE_4']).optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'PAUSED']).optional(),
});
