import { api } from "./client";

export type Role = "owner" | "lead" | "contributor" | "guest";

export interface Member {
  _id: string;
  role: Role;
  userId: { _id: string; name: string; email: string } | null;
}

export const ROLE_RANK: Record<Role, number> = { guest: 0, contributor: 1, lead: 2, owner: 3 };

export async function listMembers(orgId: string) {
  const { data } = await api.get<{ members: Member[] }>(`/orgs/${orgId}/members`);
  return data.members;
}

export async function inviteMember(orgId: string, email: string, role: Role) {
  await api.post(`/orgs/${orgId}/invite`, { email, role });
}

export async function changeRole(orgId: string, memberId: string, role: Role) {
  await api.patch(`/orgs/${orgId}/members/${memberId}`, { role });
}

export async function removeMember(orgId: string, memberId: string) {
  await api.delete(`/orgs/${orgId}/members/${memberId}`);
}