import { useEffect, useState } from "react";
import * as notificationsApi from "../api/notifications";
import { connectSocket } from "../socket";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<notificationsApi.Notification[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const data = await notificationsApi.listNotifications();
        if (active) {
          setNotifications(data);
          setError("");
        }
      } catch {
        if (active) setError("Could not load notifications.");
      }
    }

    void loadNotifications();
    const socket = connectSocket();
    socket.on("notification:new", loadNotifications);
    function handleTicketNotificationsRead(event: Event) {
      const { ticketId } = (event as CustomEvent<{ ticketId: string }>).detail;
      setNotifications((current) =>
        current.filter((notification) => notification.ticketId?._id !== ticketId)
      );
    }
    window.addEventListener("ticket-notifications-read", handleTicketNotificationsRead);

    return () => {
      active = false;
      socket.off("notification:new", loadNotifications);
      window.removeEventListener("ticket-notifications-read", handleTicketNotificationsRead);
    };
  }, []);

  async function handleMarkRead(notificationId: string) {
    setError("");
    try {
      await notificationsApi.markNotificationRead(notificationId);
      setNotifications((current) =>
        current.filter((notification) => notification._id !== notificationId)
      );
    } catch {
      setError("Could not mark the notification as read.");
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <aside className="notification-center" aria-label="Notifications">
      <h2>Notifications ({unreadCount})</h2>
      {error && <p role="alert">{error}</p>}
      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <ul>
          {notifications.map((notification) => {
            const ticketTitle = notification.ticketId?.title ?? "a ticket";
            const message = notification.type === "mention"
              ? `You were mentioned in a comment on "${ticketTitle}".`
              : `There is a new comment on your assigned ticket "${ticketTitle}".`;

            return (
              <li key={notification._id} aria-label={notification.read ? "Read" : "Unread"}>
                <span>{message}</span>
                {!notification.read && (
                  <button
                    type="button"
                    onClick={() => void handleMarkRead(notification._id)}
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
