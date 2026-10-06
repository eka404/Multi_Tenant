import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as orgsApi from "../api/orgs";

export default function ProjectsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<orgsApi.Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    orgsApi.listProjects(orgId).then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, [orgId]);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !newProjectName.trim()) return;
    const project = await orgsApi.createProject(orgId, newProjectName.trim());
    setProjects((prev) => [...prev, project]);
    setNewProjectName("");
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project._id}>
            <button onClick={() => navigate(`/orgs/${orgId}/projects/${project._id}/board`)}>
              {project.name}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreateProject}>
        <input
          placeholder="New project name"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}