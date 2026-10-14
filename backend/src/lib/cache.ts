import { redis } from "../config/redis.js";

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      console.warn("cache read failed, using the database:", (err as Error).message);
    }
  }

  const value = await load();

  if (redis) {
    redis
      .set(key, JSON.stringify(value), "EX", ttlSeconds)
      .catch((err) => console.warn("cache write failed:", (err as Error).message));
  }
  return value;
}

const versionKey = (orgId: string) => `analytics:ver:${orgId}`;

export async function analyticsVersion(orgId: string): Promise<string> {
  if (!redis) return "0";
  try {
    return (await redis.get(versionKey(orgId))) ?? "0";
  } catch {
    return "0";
  }
}

export async function invalidateAnalytics(orgId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(versionKey(orgId));
  } catch (err) {
    console.warn("cache invalidation failed (entries expire by TTL):", (err as Error).message);
  }
}