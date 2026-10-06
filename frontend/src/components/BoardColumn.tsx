import { useDroppable } from "@dnd-kit/core";
import type { Status, Ticket } from "../api/tickets";
import TicketCard from "./TicketCard";

const COLUMN_LABELS: Record<Status, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export default function BoardColumn({
  status,
  tickets,
}: {
  status: Status;
  tickets: Ticket[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className="board-column"
      style={{ background: isOver ? "#2a2a2a" : undefined }}
    >
      <h3>{COLUMN_LABELS[status]}</h3>
      {tickets.map((ticket) => (
        <TicketCard key={ticket._id} ticket={ticket} />
      ))}
    </div>
  );
}