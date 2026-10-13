import { useState, useEffect, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { setAccessToken } from "../api/client";
import { disconnectSocket } from "../socket";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<authApi.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .refresh()
      .then(({ accessToken }) => {
        setAccessToken(accessToken);
        return authApi.me();
      })
      .then(setUser)
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleExpired() {
      disconnectSocket();
      setUser(null);
    }
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  async function login(email: string, password: string) {
    const { user, accessToken } = await authApi.login(email, password);
    setAccessToken(accessToken);
    setUser(user);
  }

  async function register(name: string, email: string, password: string) {
    const { user, accessToken } = await authApi.register(name, email, password);
    setAccessToken(accessToken);
    setUser(user);
  }

  async function logout() {
    await authApi.logout();
    disconnectSocket();
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}