import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as orgsApi from "../api/orgs";

export default function OrgsPage() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<orgsApi.OrganizationMembership[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orgsApi.listMyOrgs().then((data) => {
      setOrgs(data);
      setLoading(false);
    });
  }, []);

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const org = await orgsApi.createOrg(newOrgName.trim());
    setOrgs((prev) => [...prev, org]);
    setNewOrgName("");
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Your organizations</h1>
      <ul>
        {orgs.map((org, index) => (
          <li key={org?._id ?? `unavailable-${index}`}>
            {org ? (
              <button onClick={() => navigate(`/orgs/${org._id}/projects`)}>{org.name}</button>
            ) : (
              <span>Organization unavailable</span>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreateOrg}>
        <input
          placeholder="New organization name"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}