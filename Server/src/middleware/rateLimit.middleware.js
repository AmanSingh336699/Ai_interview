import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    
    skip: (req) => req.user?.isAdmin === true,
    keyGenerator: (req) => {
      
      return req.user?.id || req.ip;
    },
  });
}

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth attempts. Please try again in 15 minutes.',
});

export const answerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Answer submission limit reached. Please try again later.',
});

export const hintLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'Hint request limit reached. Please try again later.',
});

export const aiLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'AI evaluation limit reached. Upgrade to Pro for higher limits.',
});

export const generalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests. Please slow down.',
});
