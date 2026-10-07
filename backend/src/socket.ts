import type { Server as HTTPServer } from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";

interface AuthedSocket extends Socket {
  userId?: string;
}
let io: Server | undefined;

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {cors: { origin: "http://localhost:5173", credentials: true },});
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No token provided"));
    try {
      const payload = jwt.verify(token, env.jwtAccessSecret) as { userId: string };
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });
  io.on("connection", (socket: AuthedSocket) => {
    socket.on("joinProject", (projectId: string) => socket.join(`project:${projectId}`));
    socket.on("leaveProject", (projectId: string) => socket.leave(`project:${projectId}`));
  });
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}