import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { prisma } from '../config/database.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Access token is required');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        level: true,
        role: true,
        plan: true,
        planExpiry: true,
        isAdmin: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Access token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(ApiError.unauthorized('Invalid access token'));
    }
    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, plan: true, isAdmin: true },
    });

    if (user) req.user = user;
    next();
  } catch {
    
    next();
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

export const requirePlan = (allowedPlans = ['PRO', 'PREMIUM', 'TEAM']) => {
  return (req, res, next) => {
    
    if (req.user?.isAdmin) {
      return next();
    }

    const userPlan = req.user?.plan;
    if (!allowedPlans.includes(userPlan)) {
      return next(ApiError.forbidden(`This feature requires one of: ${allowedPlans.join(', ')}`));
    }

    
    if (req.user.planExpiry && new Date(req.user.planExpiry) < new Date()) {
      return next(ApiError.forbidden('Your plan has expired. Please renew.'));
    }

    next();
  };
};
