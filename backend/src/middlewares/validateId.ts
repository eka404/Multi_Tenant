import type { NextFunction, Request, Response } from "express";

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

export function validateObjectId(_req: Request, res: Response, next: NextFunction, value: string) {
  if (!isObjectId(value)) return res.status(400).json({ message: "Invalid id" });
  next();
}