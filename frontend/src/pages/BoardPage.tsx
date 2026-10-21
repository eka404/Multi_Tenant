import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import * as ticketsApi from "../api/tickets";
import BoardColumn from "../components/BoardColumn";
import BoardSkeleton from "../components/BoardSkeleton";
import TicketDrawer from "../components/TicketDrawer";
import { useAuth } from "../context/authContext";
import { useOrgMembers } from "../hooks/useOrgMembers";
import { useToast } from "../context/toastContext";
import { errorMessage } from "../lib/errors";
import { connectSocket } from "../socket";

const STATUSES: ticketsApi.Status[] = ["todo", "in_progress", "review", "done"];
const PRIORITY_FILTERS: ticketsApi.Priority[] = ["urgent", "high", "medium", "low"];

export default function BoardPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { members, canWrite, canDelete } = useOrgMembers(orgId);

  const [tickets, setTickets] = useState<ticketsApi.Ticket[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchResult, setSearchResult] = useState<{ q: string; ids: Set<string> } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const assigneeFilter = params.get("assignee") ?? "";
  const priorityFilter = params.get("priority") ?? "";
  const boardFiltersActive = Boolean(assigneeFilter || priorityFilter);
  const filtersActive = Boolean(query || boardFiltersActive);

  function setFilter(key: "assignee" | "priority", value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  function setSearchQuery(value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true }
    );
  }

  const searchRef = useRef<HTMLInputElement>(null);
  const newTicketRef = useRef<HTMLInputElement>(null);

  const people = useMemo(
    () => new Map(members.flatMap((m) => (m.userId ? [[m.userId._id, m.userId] as const] : []))),
    [members]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  useEffect(() => {
    if (!orgId || !projectId) return;
    ticketsApi
      .listTickets(orgId, projectId)
      .then(setTickets)
      .catch(() => setError("Could not load this board. You may not have access to this project."))
      .finally(() => setLoading(false));
  }, [orgId, projectId]);

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
      setTickets((prev) => (prev.some((t) => t._id === created._id) ? prev : [...prev, created]));
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

  useEffect(() => {
    const q = query.trim();
    if (!orgId || !projectId || q.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      ticketsApi
        .searchTickets(orgId, q, projectId)
        .then((found) => {
          if (!cancelled) setSearchResult({ q, ids: new Set(found.map((t) => t._id)) });
        })
        .catch(() => {
          if (!cancelled) setSearchResult({ q, ids: new Set() });
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, orgId, projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || openId) return;
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" && canWrite) {
        e.preventDefault();
        newTicketRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, canWrite]);

  function matchesFilters(t: ticketsApi.Ticket) {
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (assigneeFilter === "me") return t.assigneeId === user?.id;
    if (assigneeFilter === "none") return t.assigneeId === null;
    if (assigneeFilter) return t.assigneeId === assigneeFilter;
    return true;
  }

  const trimmed = query.trim();
  const activeResult = trimmed.length >= 2 && searchResult?.q === trimmed ? searchResult : null;
  const visibleTickets = tickets.filter(
    (t) => (!activeResult || activeResult.ids.has(t._id)) && matchesFilters(t)
  );
  const openTicket = tickets.find((t) => t._id === openId) ?? null;

  async function handleCreateTicket(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !projectId || !newTitle.trim()) return;
    try {
      const ticket = await ticketsApi.createTicket(orgId, projectId, newTitle.trim());
      setTickets((prev) => (prev.some((t) => t._id === ticket._id) ? prev : [...prev, ticket]));
      setNewTitle("");
    } catch (err) {
      toast(errorMessage(err, "Could not add the ticket"), "error");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !orgId) return;

    const ticketId = active.id as string;
    const newStatus = over.id as ticketsApi.Status;
    const ticket = tickets.find((t) => t._id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, status: newStatus } : t)));

    try {
      await ticketsApi.updateTicketStatus(orgId, ticketId, newStatus);
    } catch (err) {
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, status: ticket.status } : t)));
      toast(errorMessage(err, "Could not move the ticket"), "error");
    }
  }

  if (loading) return <BoardSkeleton />;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/orgs/${orgId}/projects`} className="text-sm text-slate-400 hover:text-slate-200">
          ← Projects
        </Link>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input
            ref={searchRef}
            type="search"
            className="input sm:w-56"
            placeholder="Search tickets...  ( / )"
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {canWrite ? (
            <form onSubmit={handleCreateTicket} className="flex flex-1 gap-2 sm:flex-none">
              <input
                ref={newTicketRef}
                className="input sm:w-56"
                placeholder="New ticket title  ( n )"
                maxLength={200}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="submit" className="btn-primary shrink-0">Add ticket</button>
            </form>
          ) : (
            members.length > 0 && <span className="self-center text-xs text-slate-500">Read-only access</span>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="input !w-auto"
          value={assigneeFilter}
          onChange={(e) => setFilter("assignee", e.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="">All assignees</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {[...people.entries()].map(([id, person]) => (
            <option key={id} value={id}>{person.name}</option>
          ))}
        </select>
        <select
          className="input !w-auto"
          value={priorityFilter}
          onChange={(e) => setFilter("priority", e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {PRIORITY_FILTERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {filtersActive && (
          <button onClick={() => setParams({}, { replace: true })} className="btn-ghost">
            Clear filters
          </button>
        )}
      </div>

      {trimmed.length >= 2 && !activeResult && (
        <p className="mb-3 text-sm text-slate-400">Searching tickets...</p>
      )}

      {(boardFiltersActive || activeResult) && (
        <p className="mb-3 text-sm text-slate-400">
          Showing {visibleTickets.length} of {tickets.length} tickets
          {activeResult && ` matching "${trimmed}"`}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tickets={visibleTickets.filter((t) => t.status === status)}
              people={people}
              canDrag={canWrite}
              onOpen={setOpenId}
            />
          ))}
        </div>
      </DndContext>

      {openTicket && orgId && (
        <TicketDrawer
          key={openTicket._id}
          orgId={orgId}
          ticket={openTicket}
          members={members}
          canWrite={canWrite}
          canDelete={canDelete}
          onClose={() => setOpenId(null)}
          onChanged={(updated) => setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)))}
          onDeleted={(id) => {
            setTickets((prev) => prev.filter((t) => t._id !== id));
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}