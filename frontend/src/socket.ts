import { io, type Socket } from "socket.io-client";
import { getAccessToken, setAccessToken } from "./api/client";
import { refresh } from "./api/auth";

let socket: Socket | null = null;
let authRetries = 0;

export function connectSocket(): Socket {
  if (socket) return socket;

  const url = import.meta.env.VITE_SOCKET_URL as string | undefined;
  const options = {
    auth: (cb: (data: object) => void) => cb({ token: getAccessToken() }),
  };
  socket = url ? io(url, options) : io(options);

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