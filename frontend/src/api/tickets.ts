import { api } from "./client";

export type Status = "todo" | "in_progress" | "review" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Ticket {
  _id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  projectId: string;
}

export async function listTickets(orgId: string, projectId: string) {
  const { data } = await api.get<{ tickets: Ticket[] }>(
    `/orgs/${orgId}/projects/${projectId}/tickets`
  );
  return data.tickets;
}

export async function createTicket(orgId: string, projectId: string, title: string) {
  const { data } = await api.post<{ ticket: Ticket }>(
    `/orgs/${orgId}/projects/${projectId}/tickets`,
    { title }
  );
  return data.ticket;
}

export async function updateTicketStatus(orgId: string, ticketId: string, status: Status) {
  const { data } = await api.patch<{ ticket: Ticket }>(`/orgs/${orgId}/tickets/${ticketId}`, {
    status,
  });
  return data.ticket;
}