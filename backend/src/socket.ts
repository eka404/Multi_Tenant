import type { Server as HTTPServer } from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { Project } from "./models/Project.js";
import { Membership } from "./models/Membership.js";
import { isObjectId } from "./middlewares/validateId.js"; 

interface AuthedSocket extends Socket {
  userId?: string;
}
let io: Server | undefined;

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, { cors: { origin: env.clientOrigin, credentials: true } });
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
    socket.join(`user:${socket.userId}`);
    socket.on("joinProject", async (projectId: unknown) => {
      try {
        if (!isObjectId(projectId)) return;
        const project = await Project.findById(projectId).select("orgId");
        if (!project) return;
        const member = await Membership.exists({ userId: socket.userId, orgId: project.orgId });
        if (member) {
          socket.join(`project:${projectId}`);
        } else {
          console.warn(`joinProject denied: user ${socket.userId} is not in the org for project ${projectId}`);
        }
      } catch (err) {
        console.error("joinProject failed", err);
      }
    });
    socket.on("leaveProject", (projectId: string) => socket.leave(`project:${projectId}`));
  });
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}