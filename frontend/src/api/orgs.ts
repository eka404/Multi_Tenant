import { api } from "./client";

export interface Organization {
  _id: string;
  name: string;
  ownerId: string;
}

export interface Project {
  _id: string;
  orgId: string;
  name: string;
}

export async function createOrg(name: string) {
  const { data } = await api.post<{ org: Organization }>("/orgs", { name });
  return data.org;
}

export async function listProjects(orgId: string) {
  const { data } = await api.get<{ projects: Project[] }>(`/orgs/${orgId}/projects`);
  return data.projects;
}

export async function createProject(orgId: string, name: string) {
  const { data } = await api.post<{ project: Project }>(`/orgs/${orgId}/projects`, { name });
  return data.project;
}

export async function listMyOrgs() {
  const { data } = await api.get<{ organizations: Organization[] }>("/orgs/mine");
  return data.organizations;
}