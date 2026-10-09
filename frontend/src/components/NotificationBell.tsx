import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as notificationsApi from "../api/notifications";
import { connectSocket } from "../socket";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<notificationsApi.AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter((n) => !n.read).length;

  async function refresh() {
    setItems(await notificationsApi.listNotifications());
  }

  useEffect(() => {
    refresh();
    const socket = connectSocket();
    socket.on("notification:new", refresh);
    function handleTicketNotificationsRead(event: Event) {
      const { ticketId } = (event as CustomEvent<{ ticketId: string }>).detail;
      setItems((current) =>
        current.map((notification) => (
          notification.ticketId?._id === ticketId
            ? { ...notification, read: true }
            : notification
        ))
      );
    }
    window.addEventListener("ticket-notifications-read", handleTicketNotificationsRead);
    return () => {
      socket.off("notification:new", refresh);
      window.removeEventListener("ticket-notifications-read", handleTicketNotificationsRead);
    };
  }, []);

  async function handleClick(n: notificationsApi.AppNotification) {
    if (!n.read) {
      await notificationsApi.markRead(n._id);
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    }
    if (n.ticketId) {
      setOpen(false);
      navigate(`/orgs/${n.ticketId.orgId}/projects/${n.ticketId.projectId}/board`);
    }
  }

  async function handleMarkAll() {
    await notificationsApi.markAllRead();
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  }

  return (
    <div className="bell">
      <button onClick={() => setOpen((o) => !o)}>
        🔔{unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-header">
            <strong>Notifications</strong>
            {unread > 0 && <button onClick={handleMarkAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <p>Nothing yet</p>}
          {items.map((n) => (
            <div
              key={n._id}
              className={`bell-item ${n.read ? "" : "bell-unread"}`}
              onClick={() => handleClick(n)}
            >
              {n.type === "mention" ? "You were mentioned on" : "New comment on"}{" "}
              <em>{n.ticketId?.title ?? "a deleted ticket"}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}