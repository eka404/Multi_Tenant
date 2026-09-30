import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {env} from "../config/env.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

interface AccessPayload {
  userId: string;
}

export function verifyToken(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
    req.userId = payload.userId;
    next();
  } 
  catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}