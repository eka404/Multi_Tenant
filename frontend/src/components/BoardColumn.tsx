import { useDroppable } from "@dnd-kit/core";
import type { Status, Ticket } from "../api/tickets";
import TicketCard from "./TicketCard";

const COLUMNS: Record<Status, { label: string; dot: string }> = {
  todo: { label: "Todo", dot: "bg-slate-400" },
  in_progress: { label: "In Progress", dot: "bg-blue-400" },
  review: { label: "Review", dot: "bg-amber-400" },
  done: { label: "Done", dot: "bg-emerald-400" },
};

export default function BoardColumn({
  status,
  tickets,
  orgId,
}: {
  status: Status;
  tickets: Ticket[];
  orgId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { label, dot } = COLUMNS[status];

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[320px] w-72 shrink-0 flex-col rounded-xl border p-3 transition-colors md:w-auto md:flex-1 ${
        isOver ? "border-indigo-500 bg-slate-800/60" : "border-slate-800 bg-slate-900/50"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h3 className="text-sm font-medium">{label}</h3>
        <span className="ml-auto rounded-full bg-slate-800 px-2 text-xs text-slate-400">{tickets.length}</span>
      </div>
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <TicketCard key={ticket._id} ticket={ticket} orgId={orgId} />
        ))}
        {tickets.length === 0 && <p className="py-6 text-center text-xs text-slate-600">No tickets</p>}
      </div>
    </div>
  );
}