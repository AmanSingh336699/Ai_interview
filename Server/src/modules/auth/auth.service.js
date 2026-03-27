import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { cacheSet, cacheGet, cacheDel } from '../../config/redis.js';
import { ApiError } from '../../utils/ApiError.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export async function generateRefreshToken(payload) {
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  
  await cacheSet(`refresh:${payload.userId}`, token, 7 * 24 * 60 * 60);
  return token;
}

export async function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    
    
    const currentToken = await cacheGet(`refresh:${decoded.userId}`);
    if (currentToken === token) return decoded;

    
    const prevToken = await cacheGet(`refresh:${decoded.userId}:prev`);
    if (prevToken === token) {
      return decoded;
    }

    throw ApiError.unauthorized('Refresh token has been revoked');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid refresh token');
  }
}

export async function verifySocketToken(token) {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, plan: true, isAdmin: true },
    });
    if (!user) throw new Error('User not found');
    return user;
  } catch {
    throw new Error('Invalid token');
  }
}

export async function registerUser({ name, email, password }) {
  
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  
  const adminEmails = env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase());
  const isAdmin = adminEmails.includes(email.toLowerCase());

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin,
      
      plan: isAdmin ? 'PREMIUM' : 'FREE',
      profile: { create: {} },
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      level: true,
      role: true,
      plan: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = await generateRefreshToken({ userId: user.id });

  return { user, accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      passwordHash: true,
      level: true,
      role: true,
      plan: true,
      planExpiry: true,
      isAdmin: true,
      provider: true,
    },
  });

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  
  if (user.provider !== 'email' && !user.passwordHash) {
    throw ApiError.badRequest(`This account uses ${user.provider} login. Please use that method.`);
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  
  const { passwordHash: _, ...userWithoutPassword } = user;

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = await generateRefreshToken({ userId: user.id });

  return { user: userWithoutPassword, accessToken, refreshToken };
}

export async function refreshTokens(refreshToken) {
  const decoded = await verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  
  const currentToken = await cacheGet(`refresh:${user.id}`);
  if (currentToken) {
    await cacheSet(`refresh:${user.id}:prev`, currentToken, 30); 
  }

  const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
  const newRefreshToken = await generateRefreshToken({ userId: user.id });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(userId) {
  await cacheDel(`refresh:${userId}`);
}
