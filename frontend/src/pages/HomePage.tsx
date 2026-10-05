import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user, logout } = useAuth();
  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <button onClick={logout}>Log out</button>
    </div>
  );
}