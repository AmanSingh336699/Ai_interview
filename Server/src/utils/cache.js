import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';
import crypto from 'crypto';

export function makeCacheKey(prefix, data) {
  const hash = crypto
    .createHash('md5')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');
  return `${prefix}:${hash}`;
}

export async function cacheWrap(key, fn, ttlSeconds = 3600) {
  const cached = await cacheGet(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return cached;
    }
  }

  const result = await fn();
  const serialized = typeof result === 'string' ? result : JSON.stringify(result);
  await cacheSet(key, serialized, ttlSeconds);
  return result;
}

export async function invalidateCache(key) {
  await cacheDel(key);
}
