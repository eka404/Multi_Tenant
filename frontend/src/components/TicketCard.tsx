import { useDraggable } from "@dnd-kit/core";
import type { Priority, Ticket } from "../api/tickets";
import Avatar from "./Avatar";
import { dueState, formatDue } from "../lib/dates";

const DUE_STYLES = {
  overdue: "bg-red-950 text-red-300",
  today: "bg-amber-950 text-amber-300",
  upcoming: "bg-slate-800 text-slate-400",
} as const;

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-slate-800 text-slate-300",
  medium: "bg-blue-950 text-blue-300",
  high: "bg-amber-950 text-amber-300",
  urgent: "bg-red-950 text-red-300",
};

export default function TicketCard({
  ticket,
  assignee,
  canDrag,
  onOpen,
}: {
  ticket: Ticket;
  assignee?: { name: string };
  canDrag: boolean;
  onOpen: (ticketId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket._id,
    disabled: !canDrag,
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const due = dueState(ticket.dueDate, ticket.status === "done");

  return (
    <div
    ref={setNodeRef}
    style={style}
    {...listeners}
    {...attributes}
    onClick={() => onOpen(ticket._id)}
    onKeyDown={(e) => e.key === "Enter" && onOpen(ticket._id)}
    className={`rounded-lg border border-slate-800 bg-slate-900 p-3 shadow-sm transition-colors hover:border-slate-700 ${
      canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
    } ${isDragging ? "opacity-60" : ""}`}
    >
      <p className="text-sm">{ticket.title}</p>

      {ticket.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.labels.map((label) => (
            <span key={label} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_STYLES[ticket.priority]}`}>
            {ticket.priority}
          </span>
          {ticket.dueDate && due && (
            <span className={`rounded px-1.5 py-0.5 text-xs ${DUE_STYLES[due]}`}>
              {due === "overdue" ? "Overdue · " : ""}
              {formatDue(ticket.dueDate)}
            </span>
          )}
        </div>
        {assignee ? <Avatar name={assignee.name} /> : <span className="text-xs text-slate-600">Unassigned</span>}
      </div>
    </div>
  );
}