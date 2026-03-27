import { verifySocketToken } from '../modules/auth/auth.service.js';
import { logger } from '../config/logger.js';

export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    logger.warn('Socket connection rejected — no token');
    return next(new Error('Authentication required'));
  }

  verifySocketToken(token)
    .then((user) => {
      socket.userId = user.id;
      socket.user = user;
      next();
    })
    .catch((err) => {
      logger.warn(`Socket auth failed: ${err.message}`);
      next(new Error('Invalid token'));
    });
}
