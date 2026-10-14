import { Link, Outlet, matchPath, useLocation } from "react-router-dom";
import { useAuth } from "../context/authContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const orgMatch = matchPath({ path: "/orgs/:orgId/*", end: false }, location.pathname);
  const orgId = orgMatch?.params.orgId;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-semibold tracking-tight">Issue Tracker</Link>
            {orgId && (
              <Link to={`/orgs/${orgId}/projects`} className="text-sm text-slate-300 hover:text-white">
                Projects
              </Link>
            )}
            {orgId && (
              <Link to={`/orgs/${orgId}/analytics`} className="text-sm text-slate-300 hover:text-white">
                Analytics
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="hidden text-sm text-slate-400 sm:inline">{user?.name}</span>
            <button onClick={logout} className="btn-ghost">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}