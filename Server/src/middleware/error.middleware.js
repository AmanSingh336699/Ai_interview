import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || [];

  
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this data already exists';
    errors = [{ field: err.meta?.target?.join(', '), message: 'Must be unique' }];
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${message}`, {
      error: err.stack,
      body: req.body,
      userId: req.user?.id,
    });
  } else {
    logger.warn(`[${req.method}] ${req.path} — ${statusCode} ${message}`);
  }

  
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: errors.length > 0 ? errors : undefined,
    
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};
