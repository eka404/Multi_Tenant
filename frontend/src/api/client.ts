import axios from "axios";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials:true
});
let accessToken: string|null = null;

export function setAccessToken(token: string|null){
    accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
    if(accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
});