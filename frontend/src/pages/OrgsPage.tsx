import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as orgsApi from "../api/orgs";

export default function OrgsPage() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<orgsApi.Organization[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    orgsApi
      .listMyOrgs()
      .then(setOrgs)
      .catch(() => setError("Could not load organizations"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setError("");
    try {
      const org = await orgsApi.createOrg(newOrgName.trim());
      setOrgs((prev) => [...prev, org]);
      setNewOrgName("");
    } catch {
      setError("Could not create organization");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Your organizations</h1>
      <p className="mt-1 text-sm text-slate-400">Pick a workspace or create a new one.</p>

      <form onSubmit={handleCreateOrg} className="mt-6 flex max-w-md gap-2">
        <input className="input" placeholder="New organization name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
        <button type="submit" className="btn-primary shrink-0">Create</button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-6 text-slate-400">Loading...</p>
      ) : orgs.length === 0 ? (
        <p className="mt-6 text-slate-500">You're not in any organization yet. Create your first one above.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <button
              key={org._id}
              onClick={() => navigate(`/orgs/${org._id}/projects`)}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-indigo-500"
            >
              <span className="font-medium">{org.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}