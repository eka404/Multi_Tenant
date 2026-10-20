import axios from "axios";

export function errorMessage(err: unknown, fallback: string){
  if (!axios.isAxiosError(err)) return fallback;
  if (err.response?.data?.message) return String(err.response.data.message);
  if (err.code === "ERR_NETWORK") {
    return "Could not reach the server. Check your connection and try again.";
  }
  return fallback;
}