import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { setAccessToken } from "../api/client";

interface AuthContextValue {
  user: authApi.User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}