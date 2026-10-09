import { api } from "./client";

export interface Comment {
  _id: string;
  body: string;
  authorId: { _id: string; name: string };
  createdAt: string;
}

export async function listComments(orgId: string, ticketId: string) {
  const { data } = await api.get<{ comments: Comment[] }>(
    `/orgs/${orgId}/tickets/${ticketId}/comments`
  );
  return data.comments;
}

export async function createComment(orgId: string, ticketId: string, body: string) {
  const { data } = await api.post<{ comment: Comment }>(
    `/orgs/${orgId}/tickets/${ticketId}/comments`,
    { body }
  );
  return data.comment;
}