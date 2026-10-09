import { useDraggable } from "@dnd-kit/core";
import type { Ticket } from "../api/tickets";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import * as commentsApi from "../api/comments";
import * as notificationsApi from "../api/notifications";
import { connectSocket } from "../socket";

export default function TicketCard({ ticket, orgId }: { ticket: Ticket; orgId: string }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<commentsApi.Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [addingComment, setAddingComment] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const commentsRequest = useRef(0);

  const loadComments = useCallback(async (showLoading = true) => {
    const requestId = ++commentsRequest.current;
    if (showLoading) {
      setCommentsLoading(true);
      setCommentsError("");
    }
    try {
      const data = await commentsApi.listComments(orgId, ticket._id);
      if (requestId === commentsRequest.current) {
        setComments(data);
        setCommentsError("");
      }
    } catch {
      if (requestId === commentsRequest.current) {
        setCommentsError("Could not load comments. Please try again.");
      }
    } finally {
      if (requestId === commentsRequest.current) setCommentsLoading(false);
    }
  }, [orgId, ticket._id]);

  useEffect(() => {
    const requestId = ++commentsRequest.current;
    const socket = connectSocket();
    function handleCommentCreated(comment: { ticketId: string }) {
      if (comment.ticketId !== ticket._id) return;
      void loadComments(false);
    }
    socket.on("comment:created", handleCommentCreated);
    commentsApi.listComments(orgId, ticket._id)
      .then((data) => {
        if (requestId === commentsRequest.current) {
          setComments(data);
          setCommentsError("");
        }
      })
      .catch(() => {
        if (requestId === commentsRequest.current) {
          setCommentsError("Could not load comment count.");
        }
      })
      .finally(() => {
        if (requestId === commentsRequest.current) setCommentsLoading(false);
      });

    return () => {
      commentsRequest.current += 1;
      socket.off("comment:created", handleCommentCreated);
    };
  }, [loadComments, orgId, ticket._id]);

  async function handleToggleComments() {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    void loadComments();
    try {
      await notificationsApi.markTicketNotificationsRead(ticket._id);
      window.dispatchEvent(
        new CustomEvent("ticket-notifications-read", { detail: { ticketId: ticket._id } })
      );
    } catch {
      setCommentsError("Could not clear notifications for this ticket.");
    }
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    const body = newComment.trim();
    if (!body || addingComment) return;
    setAddingComment(true);
    setCommentsError("");
    try {
      await commentsApi.createComment(orgId, ticket._id, body);
      setNewComment("");
      await loadComments();
    } catch {
      setCommentsError("Could not add the comment. Please try again.");
    } finally {
      setAddingComment(false);
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: ticket._id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="ticket-card"
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="ticket-drag-handle"
        aria-label={`Drag ${ticket.title}`}
      >
        <p>{ticket.title}</p>
        <span className={`priority priority-${ticket.priority}`}>{ticket.priority}</span>
      </div>

      <button type="button" onClick={() => void handleToggleComments()}>
        {showComments
          ? "Hide comments"
          : `Comments (${commentsLoading ? "…" : comments.length})`}
      </button>
      {commentsError && <p role="alert">{commentsError}</p>}

      {showComments && (
        <div>
          {commentsLoading && <p>Loading comments...</p>}
          <ul>
            {comments.map((comment) => (
              <li key={comment._id}>
                <strong>{comment.authorId.name}</strong>: {comment.body}
              </li>
            ))}
          </ul>

          <form onSubmit={(event) => void handleAddComment(event)}>
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment"
            />
            <button type="submit" disabled={addingComment || !newComment.trim()}>
              {addingComment ? "Adding..." : "Add comment"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}