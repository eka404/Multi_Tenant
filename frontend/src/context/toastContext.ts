import { createContext, useContext } from "react";

export type ToastKind = "success" | "error";
export type ToastMessage = (message: string, kind?: ToastKind) => void;

export const ToastContext = createContext<ToastMessage>(() => {});

export function useToast() {
  return useContext(ToastContext);
}
