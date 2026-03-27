import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

let prisma;

if (env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: env.DATABASE_URL } },
  });
} else {
  
  if (!globalThis.__prisma) {
    globalThis.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
      datasources: { db: { url: env.DATABASE_URL } },
    });
  }
  prisma = globalThis.__prisma;
}

export { prisma };
