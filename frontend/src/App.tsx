import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OrgsPage from "./pages/OrgsPage";
import ProjectsPage from "./pages/ProjectsPage";
import BoardPage from "./pages/BoardPage";
import Layout from "./components/Layout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<OrgsPage />} />
            <Route path="/orgs/:orgId/projects" element={<ProjectsPage />} />
            <Route path="/orgs/:orgId/projects/:projectId/board" element={<BoardPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}