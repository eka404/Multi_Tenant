import { api } from "./client";

export interface User{
    id:string;
    name:string;
    email:string;
}

interface AuthResponse{
    user:User;
    accessToken:string;
}

export async function register(name:string, email:string, password:string) {
    const { data } = await api.post<AuthResponse>("/auth/register", { name, email, password });
    return data;
}

export async function login(email:string, password:string) {
    const {data} = await api.post<AuthResponse>("/auth/login", {email, password});
    return data;
}

export async function refresh() {
    const {data} = await api.post<{accessToken: string}>("/auth/refresh");
    return data;
}

export async function logout() {
    await api.post("/auth/logout");
}

export async function me() {
    const {data} = await api.get<{user:User}>("/auth/me");
    return data.user;
}