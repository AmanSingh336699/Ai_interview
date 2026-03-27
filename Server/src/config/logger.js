import winston from 'winston';
import morgan from 'morgan';
import { env } from './env.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

/**
 * Winston logger instance.
 * In production, logs to combined.log + error.log files.
 * In development, logs to console with colors.
 */
const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })),
  defaultMeta: { service: 'ai-mock-interviewer' },
  transports: [
    
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        devFormat
      ),
    }),
  ],
});


if (env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), json()),
      maxsize: 10 * 1024 * 1024, 
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

const morganStream = {
  write: (message) => logger.http(message.trim()),
};

const httpLogger = morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev',
  { stream: morganStream }
);

export { logger, httpLogger };
