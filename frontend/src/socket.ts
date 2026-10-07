import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api/client";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io("http://localhost:5000", { auth: { token: getAccessToken() } });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}