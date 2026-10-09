import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import * as ticketsApi from "../api/tickets";
import BoardColumn from "../components/BoardColumn";
import { connectSocket } from "../socket";

const STATUSES: ticketsApi.Status[] = ["todo", "in_progress", "review", "done"];

export default function BoardPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const [tickets, setTickets] = useState<ticketsApi.Ticket[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [error, setError] = useState("");

  function mergeTickets(current: ticketsApi.Ticket[], incoming: ticketsApi.Ticket[]) {
    const byId = new Map(current.map((ticket) => [ticket._id, ticket]));
    incoming.forEach((ticket) => byId.set(ticket._id, ticket));
    return [...byId.values()];
  }

  useEffect(() => {
    if (!orgId || !projectId) {
      setError("Organization or project is missing.");
      setLoading(false);
      return;
    }
    let active = true;
    setTickets([]);
    setLoading(true);
    setError("");
    ticketsApi.listTickets(orgId, projectId)
      .then((data) => {
        if (active) setTickets((current) => mergeTickets(current, data));
      })
      .catch(() => {
        if (active) setError("Could not load tickets. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgId, projectId]);

  useEffect(() => {
    if (!projectId) return;
    const socket = connectSocket();
    socket.emit("joinProject", projectId);

    function handleUpdated(updated: ticketsApi.Ticket) {
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    }
    function handleCreated(created: ticketsApi.Ticket) {
      setTickets((prev) => mergeTickets(prev, [created]));
    }
    function handleDeleted({ ticketId }: { ticketId: string }) {
      setTickets((prev) => prev.filter((t) => t._id !== ticketId));
    }

    socket.on("ticket:updated", handleUpdated);
    socket.on("ticket:created", handleCreated);
    socket.on("ticket:deleted", handleDeleted);

    return () => {
      socket.emit("leaveProject", projectId);
      socket.off("ticket:updated", handleUpdated);
      socket.off("ticket:created", handleCreated);
      socket.off("ticket:deleted", handleDeleted);
    };
  }, [projectId]);

  async function handleCreateTicket(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!orgId || !projectId || !title || creatingTicket) return;
    setCreatingTicket(true);
    setError("");
    try {
      const ticket = await ticketsApi.createTicket(orgId, projectId, title);
      setTickets((prev) => mergeTickets(prev, [ticket]));
      setNewTitle("");
    } catch {
      setError("Could not create the ticket. Please try again.");
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !orgId) return;

    const ticketId = active.id as string;
    const newStatus = over.id as ticketsApi.Status;
    const ticket = tickets.find((t) => t._id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    setTickets((prev) =>
      prev.map((t) => (t._id === ticketId ? { ...t, status: newStatus } : t))
    );

    try {
      await ticketsApi.updateTicketStatus(orgId, ticketId, newStatus);
    } catch {
      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId ? { ...t, status: ticket.status } : t))
      );
    }
  }

  if (!orgId || !projectId) return <p role="alert">Organization or project is missing.</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <form onSubmit={handleCreateTicket}>
        <input
          placeholder="New ticket title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" disabled={creatingTicket || !newTitle.trim()}>
          {creatingTicket ? "Adding..." : "Add ticket"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="board">
          {STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              orgId={orgId}
              tickets={tickets.filter((t) => t.status === status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}