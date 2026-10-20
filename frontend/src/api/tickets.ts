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
  assigneeId: string | null;
  labels: string[];
  createdAt: string;
}

export type TicketPatch = Partial<Pick<Ticket, "title" | "description" | "status" | "priority" | "assigneeId" | "labels">>;

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

export async function updateTicket(orgId: string, ticketId: string, patch: TicketPatch) {
  const { data } = await api.patch<{ ticket: Ticket }>(`/orgs/${orgId}/tickets/${ticketId}`, patch);
  return data.ticket;
}

export async function updateTicketStatus(orgId: string, ticketId: string, status: Status) {
  const { data } = await api.patch<{ ticket: Ticket }>(`/orgs/${orgId}/tickets/${ticketId}`, {
    status,
  });
  return data.ticket;
}

export async function searchTickets(orgId: string, q: string, projectId?: string) {
  const { data } = await api.get<{ tickets: Ticket[] }>(`/orgs/${orgId}/search/tickets`, {
    params: { q, projectId },
  });
  return data.tickets;
}

export async function deleteTicket(orgId: string, ticketId: string) {
  await api.delete(`/orgs/${orgId}/tickets/${ticketId}`);
}