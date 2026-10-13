import { api } from "./client";

export interface Analytics {
  totals: { tickets: number; open: number; done: number };
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  workload: { userId: string | null; name: string; open: number }[];
  createdPerWeek: { week: string; count: number }[];
  completedPerWeek: { week: string; count: number }[];
  avgCycleDays: number | null;
}

export async function getAnalytics(orgId: string, weeks = 8) {
  const { data } = await api.get<Analytics>(`/orgs/${orgId}/analytics`, { params: { weeks } });
  return data;
}