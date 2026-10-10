import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL as string;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= axios
    .post<{ accessToken: string }>(`${API_URL}/auth/refresh`, null, { withCredentials: true })
    .then((res) => res.data.accessToken)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = original?.url?.startsWith("/auth/") ?? false;

    if (error.response?.status !== 401 || !original || original._retried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      const token = await refreshAccessToken();
      setAccessToken(token);
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      setAccessToken(null);
      window.dispatchEvent(new Event("auth:expired"));
      return Promise.reject(error);
    }
  }
);