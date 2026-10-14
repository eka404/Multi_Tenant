import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis: Redis | null = env.redisUrl
  ? new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
    })
  : null;

redis?.on("error", (err) => console.error("Redis error:", err.message));