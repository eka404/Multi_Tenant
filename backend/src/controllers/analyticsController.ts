import type { Response } from "express";
import { Types } from "mongoose";
import { Ticket, STATUSES, PRIORITIES } from "../models/Ticket.js";
import { isObjectId } from "../middlewares/validateId.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";
import { analyticsVersion, cached } from "../lib/cache.js";

const DAY_MS = 24 * 60 * 60 * 1000;

interface WeekRow { _id: Date; count: number }
interface Facets {
  byStatus: { _id: string; count: number }[];
  byPriority: { _id: string; count: number }[];
  workload: { userId: Types.ObjectId | null; name: string; open: number }[];
  createdPerWeek: WeekRow[];
  completedPerWeek: WeekRow[];
  cycleTime: { avgMs: number; count: number }[];
}

function mondayUtc(d: Date) {
  const sinceMonday = (d.getUTCDay() + 6) % 7; // JS counts Sunday as 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday));
}

async function computeAnalytics(orgId: string, projectId: string | undefined, weeks: number) {
  const match = {
    orgId: new Types.ObjectId(orgId),
    ...(projectId ? { projectId: new Types.ObjectId(projectId) } : {}),
  };

  const thisMonday = mondayUtc(new Date());
  const weekStarts = Array.from(
    { length: weeks },
    (_, i) => new Date(thisMonday.getTime() - (weeks - 1 - i) * 7 * DAY_MS)
  );
  const since = weekStarts[0];

  const [facets] = await Ticket.aggregate<Facets>([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byPriority: [
          { $match: { status: { $ne: "done" } } },
          { $group: { _id: "$priority", count: { $sum: 1 } } },
        ],
        workload: [
          { $match: { status: { $ne: "done" } } },
          { $group: { _id: "$assigneeId", open: { $sum: 1 } } },
          { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
          {
            $project: {
              _id: 0,
              userId: "$_id",
              name: { $ifNull: [{ $arrayElemAt: ["$user.name", 0] }, "Unassigned"] },
              open: 1,
            },
          },
          { $sort: { open: -1 } },
        ],
        createdPerWeek: [
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateTrunc: { date: "$createdAt", unit: "week", startOfWeek: "monday" } },
              count: { $sum: 1 },
            },
          },
        ],
        completedPerWeek: [
          { $match: { status: "done" } },
          { $addFields: { doneAt: { $ifNull: ["$completedAt", "$updatedAt"] } } },
          { $match: { doneAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateTrunc: { date: "$doneAt", unit: "week", startOfWeek: "monday" } },
              count: { $sum: 1 },
            },
          },
        ],
        cycleTime: [
          { $match: { status: "done" } },
          { $addFields: { doneAt: { $ifNull: ["$completedAt", "$updatedAt"] } } },
          { $group: { _id: null, avgMs: { $avg: { $subtract: ["$doneAt", "$createdAt"] } }, count: { $sum: 1 } } },
        ],
      },
    },
  ]);

  const fill = (rows: WeekRow[]) =>
    weekStarts.map((start) => ({
      week: start.toISOString().slice(0, 10),
      count: rows.find((r) => r._id.getTime() === start.getTime())?.count ?? 0,
    }));

  const statusCounts = new Map(facets.byStatus.map((r) => [r._id, r.count] as const));
  const priorityCounts = new Map(facets.byPriority.map((r) => [r._id, r.count] as const));
  const byStatus = STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));
  const total = byStatus.reduce((sum, r) => sum + r.count, 0);
  const done = statusCounts.get("done") ?? 0;
  const cycle = facets.cycleTime[0];

  return {
    totals: { tickets: total, open: total - done, done },
    byStatus,
    byPriority: PRIORITIES.map((priority) => ({ priority, count: priorityCounts.get(priority) ?? 0 })),
    workload: facets.workload.map((w) => ({ userId: w.userId?.toString() ?? null, name: w.name, open: w.open })),
    createdPerWeek: fill(facets.createdPerWeek),
    completedPerWeek: fill(facets.completedPerWeek),
    avgCycleDays: cycle ? Math.round((cycle.avgMs / DAY_MS) * 10) / 10 : null,
  };
}

export async function getAnalytics(req: OrgScopedRequest, res: Response) {
  const { projectId } = req.query;
  if (projectId !== undefined && !isObjectId(projectId)) {
    return res.status(400).json({ message: "Invalid projectId" });
  }
  const pid = typeof projectId === "string" ? projectId : undefined;
  const weeks = Math.min(26, Math.max(1, Number.parseInt(String(req.query.weeks ?? "8"), 10) || 8));
  const orgId = req.membership!.orgId;

  // the version in the key changes whenever the org's tickets change, so stale entries are never read
  const version = await analyticsVersion(orgId);
  const key = `analytics:${orgId}:${pid ?? "all"}:${weeks}:v${version}`;

  res.json(await cached(key, 60, () => computeAnalytics(orgId, pid, weeks)));
}