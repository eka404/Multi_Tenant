import { useEffect, useState, type FormEvent } from "react";
import * as ticketsApi from "../api/tickets";
import BoardColumn from "../components/BoardColumn";
import { connectSocket } from "../socket";
import { Link, useParams } from "react-router-dom";
import {DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent} from "@dnd-kit/core";

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
  if (!orgId || !projectId) return;
    ticketsApi
      .listTickets(orgId, projectId)
      .then(setTickets)
      .catch(() => setError("Could not load this board. You may not have access to this project."))
      .finally(() => setLoading(false));
  }, [orgId, projectId]);

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!orgId || !projectId || !title || creatingTicket) return;

    setCreatingTicket(true);
    setError("");
    try {
      const ticket = await ticketsApi.createTicket(orgId, projectId, title);
      setTickets((current) => mergeTickets(current, [ticket]));
      setNewTitle("");
    } catch {
      setError("Could not create the ticket. Please try again.");
    } finally {
      setCreatingTicket(false);
    }
  }

  useEffect(() => {
    if (!orgId || !projectId) return;
    const socket = connectSocket();

    const join = () => socket.emit("joinProject", projectId);
    join();
    socket.on("connect", join);

    const refetch = () => {
      ticketsApi.listTickets(orgId, projectId).then(setTickets).catch(() => {});
    };
    socket.io.on("reconnect", refetch);

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
      socket.off("connect", join);
      socket.io.off("reconnect", refetch);
      socket.off("ticket:updated", handleUpdated);
      socket.off("ticket:created", handleCreated);
      socket.off("ticket:deleted", handleDeleted);
    };
  }, [orgId, projectId]);

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
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  if (!orgId || !projectId) return <p role="alert">Organization or project is missing.</p>;
  if (loading) return <p className="text-slate-400">Loading board...</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/orgs/${orgId}/projects`} className="text-sm text-slate-400 hover:text-slate-200">
          ← Projects
        </Link>
        <form onSubmit={handleCreateTicket} className="flex w-full gap-2 sm:w-auto">
          <input
            className="input sm:w-72"
            placeholder="New ticket title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={creatingTicket || !newTitle.trim()}
          >
            {creatingTicket ? "Adding..." : "Add ticket"}
          </button>
        </form>
      </div>
      {error && <p role="alert" className="mb-4 text-red-400">{error}</p>}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tickets={tickets.filter((t) => t.status === status)}
              orgId={orgId}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}