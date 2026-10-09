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
    return () => {
      socket.off("notification:new", refresh);
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
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost relative" aria-label="Notifications">
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-xl">
            <div className="flex items-center justify-between px-2 py-1">
              <strong className="text-sm">Notifications</strong>
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-indigo-400 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-500">Nothing yet</p>}
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={`cursor-pointer rounded-md px-2 py-2 text-sm hover:bg-slate-800 ${
                    n.read ? "text-slate-400" : "border-l-2 border-indigo-500 text-slate-100"
                  }`}
                >
                  {n.type === "mention" ? "You were mentioned on" : "New comment on"}{" "}
                  <em>{n.ticketId?.title ?? "a deleted ticket"}</em>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}