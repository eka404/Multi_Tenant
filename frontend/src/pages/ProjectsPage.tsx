import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import * as orgsApi from "../api/orgs";

export default function ProjectsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<orgsApi.Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    orgsApi
      .listProjects(orgId)
      .then(setProjects)
      .catch(() => setError("Could not load projects"))
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !newProjectName.trim()) return;
    setError("");
    try {
      const project = await orgsApi.createProject(orgId, newProjectName.trim());
      setProjects((prev) => [...prev, project]);
      setNewProjectName("");
    } catch {
      setError("Could not create project (only leads and owners can)");
    }
  }

  return (
    <div>
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← Organizations</Link>
      <h1 className="mt-2 text-2xl font-semibold">Projects</h1>

      <form onSubmit={handleCreateProject} className="mt-6 flex max-w-md gap-2">
        <input className="input" placeholder="New project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
        <button type="submit" className="btn-primary shrink-0">Create</button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-6 text-slate-400">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="mt-6 text-slate-500">No projects yet. Create one above to get a board.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project._id}
              onClick={() => navigate(`/orgs/${orgId}/projects/${project._id}/board`)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-indigo-500"
            >
              <span className="font-medium">{project.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}