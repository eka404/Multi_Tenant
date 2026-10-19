import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const tooMany = {
  message: "Too many requests, please try again later",
};

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
  passOnStoreError: true,
  skip: () => env.disableRateLimits,
} as const;

export const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
});

export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
});

export const searchLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 60,
});