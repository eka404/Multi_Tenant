import { io, type Socket } from "socket.io-client";
import { getAccessToken, setAccessToken } from "./api/client";
import { refresh } from "./api/auth";

let socket: Socket | null = null;
let authRetries = 0;

export function connectSocket(): Socket {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: (cb) => cb({ token: getAccessToken() }),
  });

  socket.on("connect", () => {
    authRetries = 0;
  });

  socket.on("connect_error", async (err) => {
    if (!/token/i.test(err.message) || authRetries >= 2) return;
    authRetries++;
    try {
      const { accessToken } = await refresh();
      setAccessToken(accessToken);
      socket?.connect();
    } catch {
    }
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  authRetries = 0;
}