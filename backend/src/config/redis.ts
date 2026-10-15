import { Redis } from "ioredis";
import { env } from "./env.js";

async function isReachable(url: string): Promise<boolean> {
  const probe = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3000,
    retryStrategy: () => null, 
  });
  probe.on("error", () => {}); 
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

async function createClient(): Promise<Redis | null> {
  if (!env.redisUrl) return null;

  if (!(await isReachable(env.redisUrl))) {
    console.warn(
      "REDIS_URL is set but Redis is unreachable: continuing without Redis (no cache, in-memory rate limits, no socket adapter)"
    );
    return null;
  }

  const client = new Redis(env.redisUrl, { maxRetriesPerRequest: 1 });
  client.on("error", (err) => console.error("Redis error:", err.message));

  if (!env.isTest) {
    process.on("unhandledRejection", (reason) => {
      if (reason instanceof Error && reason.name === "MaxRetriesPerRequestError") {
        console.warn("A Redis command was dropped because Redis is unavailable");
        return;
      }
      throw reason;
    });
  }

  console.log("Redis connected");
  return client;
}

export const redis: Redis | null = await createClient();