import { api } from "./client";

export interface AppNotification {
  _id: string;
  type: "mention" | "assigned";
  read: boolean;
  createdAt: string;
  ticketId: {
    _id: string;
    title: string;
    projectId: string;
    orgId: string;
  } | null;
}

export type Notification = AppNotification;

export async function listNotifications() {
  const { data } = await api.get<{ notifications: AppNotification[] }>("/notifications");
  return data.notifications;
}

export async function markRead(id: string) {
  const { data } = await api.patch<{ notification: AppNotification }>(
    `/notifications/${id}/read`
  );
  return data.notification;
}

export async function markAllRead() {
  await api.patch("/notifications/read-all");
}

export async function markTicketNotificationsRead(ticketId: string) {
  await api.patch(`/notifications/ticket/${ticketId}/read`);
}

export const markNotificationRead = markRead;