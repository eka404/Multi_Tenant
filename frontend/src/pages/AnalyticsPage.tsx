import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import * as analyticsApi from "../api/analytics";

const STATUS_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-4 text-sm font-medium text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function BarList({
  rows,
  barClass,
}: {
  rows: { label: string; value: number }[];
  barClass: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-slate-500">Nothing to show yet</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-300">{r.label}</span>
            <span className="text-slate-400">{r.value}</span>
          </div>
          <div className="h-2 rounded bg-slate-800">
            <div className={`h-2 rounded ${barClass}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function WeekChart({ rows, barClass }: { rows: { week: string; count: number }[]; barClass: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex gap-2">
      {rows.map((r) => (
        <div key={r.week} className="flex flex-1 flex-col items-center">
          <span className="text-xs text-slate-400">{r.count}</span>
          <div className="flex h-32 w-full items-end">
            <div
              className={`w-full rounded-t ${barClass}`}
              style={{ height: `${(r.count / max) * 100}%`, minHeight: r.count ? 4 : 1 }}
            />
          </div>
          <span className="mt-1 text-[10px] text-slate-500">{r.week.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [data, setData] = useState<analyticsApi.Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    analyticsApi
      .getAnalytics(orgId)
      .then(setData)
      .catch((err) => {
        setError(
          axios.isAxiosError(err) && err.response?.status === 403
            ? "Analytics are available to leads and owners."
            : "Could not load analytics."
        );
      });
  }, [orgId]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading analytics...</p>;

  return (
    <div>
      <Link to={`/orgs/${orgId}/projects`} className="text-sm text-slate-400 hover:text-slate-200">
        ← Projects
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Analytics</h1>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total tickets" value={data.totals.tickets} />
        <Stat label="Open" value={data.totals.open} />
        <Stat label="Done" value={data.totals.done} />
        <Stat label="Avg. cycle time" value={data.avgCycleDays === null ? "—" : `${data.avgCycleDays} days`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Tickets by status">
          <BarList
            barClass="bg-indigo-500"
            rows={data.byStatus.map((r) => ({ label: STATUS_LABELS[r.status] ?? r.status, value: r.count }))}
          />
        </Panel>
        <Panel title="Open tickets by priority">
          <BarList
            barClass="bg-amber-500"
            rows={data.byPriority.map((r) => ({ label: r.priority, value: r.count }))}
          />
        </Panel>
        <Panel title="Created per week">
          <WeekChart rows={data.createdPerWeek} barClass="bg-blue-500" />
        </Panel>
        <Panel title="Completed per week">
          <WeekChart rows={data.completedPerWeek} barClass="bg-emerald-500" />
        </Panel>
        <Panel title="Open work per person">
          <BarList
            barClass="bg-violet-500"
            rows={data.workload.map((w) => ({ label: w.name, value: w.open }))}
          />
        </Panel>
      </div>
    </div>
  );
}