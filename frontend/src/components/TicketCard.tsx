import { useDraggable } from "@dnd-kit/core";
import type { Ticket } from "../api/tickets";

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket._id,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="ticket-card"
    >
      <p>{ticket.title}</p>
      <span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span>
    </div>
  );
}