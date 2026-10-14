import { rateLimit } from "express-rate-limit";
import RedisStore, { type RedisReply } from "rate-limit-redis";
import { redis } from "../config/redis.js";

const tooMany = { message: "Too many requests, please try again later" };
const redisClient = redis;

const redisStore = (prefix: string) =>
  redisClient
    ? new RedisStore({
        prefix: `rl:${prefix}:`,
        sendCommand: (command: string, ...args: string[]) =>
          redisClient.call(command, ...args) as Promise<RedisReply>,
      })
    : undefined;

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
  passOnStoreError: true,
} as const;

export const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  store: redisStore("api"),
});

export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  store: redisStore("login"),
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  store: redisStore("register"),
});

export const searchLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 60,
  store: redisStore("search"),
});