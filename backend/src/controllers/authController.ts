import jwt from "jsonwebtoken";
import {env} from "../config/env.js";
import {User} from "../models/User.js";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/auth.js";

interface AuthBody {
  name?: string;
  email?: string;
  password?: string;
}

function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtAccessSecret, { expiresIn: "15m" });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtRefreshSecret, { expiresIn: "7d" });
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function register(req: Request, res: Response){
    try {
        const { name, password } = (req.body ?? {}) as AuthBody;
        const email = (req.body as AuthBody | undefined)?.email?.toLowerCase().trim();

        if (!name || !email || !password || password.length < 8) {
            return res
            .status(400)
            .json({ message: "Name, email and a password of 8+ characters are required" });
        }

        if (await User.findOne({ email })) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, passwordHash });

        setRefreshCookie(res, signRefreshToken(user._id.toString()));
        res.status(201).json({
            user: { id: user._id, name: user.name, email: user.email },
            accessToken: signAccessToken(user._id.toString()),
        });
    } 
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

export async function login(req: Request, res: Response){
    try {
        const { password } = (req.body ?? {}) as AuthBody;
        const email = (req.body as AuthBody | undefined)?.email?.toLowerCase().trim();

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        const valid = user && (await bcrypt.compare(password, user.passwordHash));
        if (!user || !valid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        setRefreshCookie(res, signRefreshToken(user._id.toString()));
        res.json({
            user: { id: user._id, name: user.name, email: user.email },
            accessToken: signAccessToken(user._id.toString()),
        });
    } 
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

export async function me(req: AuthedRequest, res: Response) {
  const user = await User.findById(req.userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(token, env.jwtRefreshSecret) as { userId: string };
    res.json({ accessToken: signAccessToken(payload.userId) });
  } 
  catch {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
}
