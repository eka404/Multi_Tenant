import { useEffect, useState } from "react";
import * as ticketsApi from "../api/tickets";
import * as commentsApi from "../api/comments";
import type { Member } from "../api/members";
import { useToast } from "../context/toastContext";
import { errorMessage } from "../lib/errors";
import { connectSocket } from "../socket";
import Avatar from "./Avatar";

const STATUSES: { value: ticketsApi.Status; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];
const PRIORITIES: ticketsApi.Priority[] = ["low", "medium", "high", "urgent"];

export default function TicketDrawer({
  orgId,
  ticket,
  members,
  canWrite,
  canDelete,
  onClose,
  onChanged,
  onDeleted,
}: {
  orgId: string;
  ticket: ticketsApi.Ticket;
  members: Member[];
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: (ticket: ticketsApi.Ticket) => void;
  onDeleted: (ticketId: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [labelsText, setLabelsText] = useState(ticket.labels.join(", "));
  const [comments, setComments] = useState<commentsApi.Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  const people = members.flatMap((m) => (m.userId ? [m.userId] : []));
  const mentionExample = people[0]?.name.replace(/\s+/g, "") ?? "name";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      commentsApi
        .listComments(orgId, ticket._id)
        .then((data) => {
          if (!cancelled) setComments(data);
        })
        .catch((err) => {
          if (!cancelled) toast(errorMessage(err, "Could not load comments"), "error");
        });

    load();
    const socket = connectSocket();
    const onComment = (c: { ticketId: string }) => {
      if (c.ticketId === ticket._id) load();
    };
    socket.on("comment:created", onComment);
    return () => {
      cancelled = true;
      socket.off("comment:created", onComment);
    };
  }, [orgId, ticket._id, toast]);

  async function save(patch: ticketsApi.TicketPatch) {
    try {
      onChanged(await ticketsApi.updateTicket(orgId, ticket._id, patch));
    } catch (err) {
      toast(errorMessage(err, "Could not save your changes"), "error");
    }
  }

  function saveTitle() {
    const next = title.trim();
    if (!next) return setTitle(ticket.title);
    if (next !== ticket.title) save({ title: next });
  }

  function saveDescription() {
    if (description !== ticket.description) save({ description });
  }

  function saveLabels() {
    const next = [...new Set(labelsText.split(",").map((l) => l.trim()).filter(Boolean))];
    setLabelsText(next.join(", "));
    if (next.join("|") !== ticket.labels.join("|")) save({ labels: next });
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body) return;
    setPosting(true);
    try {
      await commentsApi.createComment(orgId, ticket._id, body);
      setCommentText("");
      try {
        setComments(await commentsApi.listComments(orgId, ticket._id));
      } catch (err) {
        toast(errorMessage(err, "Comment posted, but comments could not be refreshed"), "error");
      }
    } catch (err) {
      toast(errorMessage(err, "Could not post your comment"), "error");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this ticket? This can't be undone.")) return;
    try {
      await ticketsApi.deleteTicket(orgId, ticket._id);
      onDeleted(ticket._id);
      toast("Ticket deleted");
    } catch (err) {
      toast(errorMessage(err, "Could not delete the ticket"), "error");
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 cursor-default bg-black/50"
        onClick={onClose}
        aria-label="Close ticket details"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ticket details"
        className="ticket-drawer fixed right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-900 p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <input
            className="input !border-transparent !bg-transparent !px-0 text-lg font-semibold"
            value={title}
            maxLength={200}
            disabled={!canWrite}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            aria-label="Title"
          />
          <button onClick={onClose} className="btn-ghost shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">
            Status
            <select
              className="input mt-1"
              value={ticket.status}
              disabled={!canWrite}
              onChange={(e) => save({ status: e.target.value as ticketsApi.Status })}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Priority
            <select
              className="input mt-1"
              value={ticket.priority}
              disabled={!canWrite}
              onChange={(e) => save({ priority: e.target.value as ticketsApi.Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2 text-xs text-slate-400">
            Assignee
            <select
              className="input mt-1"
              value={ticket.assigneeId ?? ""}
              disabled={!canWrite}
              onChange={(e) => save({ assigneeId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2 text-xs text-slate-400">
            Labels (comma separated)
            <input
              className="input mt-1"
              value={labelsText}
              disabled={!canWrite}
              placeholder="bug, frontend"
              onChange={(e) => setLabelsText(e.target.value)}
              onBlur={saveLabels}
            />
          </label>
        </div>

        <label className="mb-4 block text-xs text-slate-400">
          Description
          <textarea
            className="input mt-1 min-h-28"
            value={description}
            maxLength={5000}
            disabled={!canWrite}
            placeholder={canWrite ? "Add more detail..." : "No description"}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
          />
        </label>

        <h3 className="mb-2 text-sm font-medium text-slate-300">Comments</h3>
        <ul className="mb-3 space-y-3">
          {comments.length === 0 && <li className="text-sm text-slate-500">No comments yet</li>}
          {comments.map((c) => (
            <li key={c._id} className="flex gap-2">
              <Avatar name={c.authorId?.name ?? "?"} />
              <div className="min-w-0">
                <p className="text-xs text-slate-400">
                  <span className="font-medium text-slate-200">{c.authorId?.name ?? "Unknown"}</span>{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {canWrite && (
          <div className="mb-6">
            <textarea
              className="input min-h-20"
              value={commentText}
              placeholder={`Write a comment. @${mentionExample} notifies that person`}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button onClick={postComment} disabled={posting || !commentText.trim()} className="btn-primary mt-2">
              {posting ? "Posting..." : "Comment"}
            </button>
          </div>
        )}

        {canDelete && (
          <button onClick={handleDelete} className="btn-ghost text-red-400">Delete ticket</button>
        )}
      </aside>
    </>
  );
}