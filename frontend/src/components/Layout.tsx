import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div>
      <header className="app-header">
        <Link to="/">Issue Tracker</Link>
        <div className="app-header-right">
          <NotificationBell />
          <span>{user?.name}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}