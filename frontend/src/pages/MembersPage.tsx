import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/authContext";
import * as membersApi from "../api/members";
import { ROLE_RANK, type Member, type Role } from "../api/members";

const ROLES_ASCENDING: Role[] = ["guest", "contributor", "lead", "owner"];

const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-violet-950 text-violet-300",
  lead: "bg-indigo-950 text-indigo-300",
  contributor: "bg-blue-950 text-blue-300",
  guest: "bg-slate-800 text-slate-300",
};

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : fallback;
}

export default function MembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("contributor");

  useEffect(() => {
    if (!orgId) return;
    membersApi
      .listMembers(orgId)
      .then(setMembers)
      .catch(() => setError("Could not load members"))
      .finally(() => setLoading(false));
  }, [orgId]);

  async function reload() {
    if (orgId) setMembers(await membersApi.listMembers(orgId));
  }

  async function run(action: () => Promise<void>, success: string) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await reload();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong"));
    }
  }

  const me = members.find((m) => m.userId?._id === user?.id);
  const myRank = me ? ROLE_RANK[me.role] : -1;
  const canManage = myRank >= ROLE_RANK.lead;
  const grantable = ROLES_ASCENDING.filter((r) => ROLE_RANK[r] < myRank);
  const sorted = [...members].sort(
    (a, b) =>
      ROLE_RANK[b.role] - ROLE_RANK[a.role] || (a.userId?.name ?? "").localeCompare(b.userId?.name ?? "")
  );

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !email.trim()) return;
    await run(async () => {
      await membersApi.inviteMember(orgId, email.trim(), inviteRole);
      setEmail("");
    }, "Member added");
  }

  async function handleRemove(m: Member) {
    if (!orgId) return;
    if (!window.confirm(`Remove ${m.userId?.name ?? "this member"} from the organization?`)) return;
    await run(() => membersApi.removeMember(orgId, m._id), "Member removed");
  }

  async function handleLeave() {
    if (!orgId || !me) return;
    if (!window.confirm("Leave this organization?")) return;
    try {
      await membersApi.removeMember(orgId, me._id);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err, "Could not leave the organization"));
    }
  }

  if (loading) return <p className="text-slate-400">Loading members...</p>;

  return (
    <div>
      <Link to={`/orgs/${orgId}/projects`} className="text-sm text-slate-400 hover:text-slate-200">
        ← Projects
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Members</h1>

      {canManage && (
        <form onSubmit={handleInvite} className="mb-2 flex flex-wrap gap-2">
          <input
            type="email"
            className="input sm:w-72"
            placeholder="Email of an existing user"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            className="input sm:w-40"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
          >
            {grantable.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Add member</button>
        </form>
      )}
      {canManage && (
        <p className="mb-4 text-xs text-slate-500">
          Only people who already have an account can be added, so ask them to register first.
        </p>
      )}

      {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
      {notice && <p className="mb-3 text-sm text-emerald-400">{notice}</p>}

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        {sorted.map((m) => {
          const isMe = m._id === me?._id;
          const manageable = canManage && !isMe && ROLE_RANK[m.role] < myRank;
          return (
            <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium">
                  {m.userId?.name ?? "Unknown user"}
                  {isMe && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                </p>
                <p className="text-xs text-slate-400">{m.userId?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {manageable ? (
                  <>
                    <select
                      className="input !w-auto"
                      value={m.role}
                      onChange={(e) =>
                        orgId &&
                        run(() => membersApi.changeRole(orgId, m._id, e.target.value as Role), "Role updated")
                      }
                    >
                      {grantable.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button onClick={() => handleRemove(m)} className="btn-ghost text-red-400">
                      Remove
                    </button>
                  </>
                ) : (
                  <span className={`rounded px-2 py-0.5 text-xs ${ROLE_BADGE[m.role]}`}>{m.role}</span>
                )}
                {isMe && m.role !== "owner" && (
                  <button onClick={handleLeave} className="btn-ghost text-red-400">Leave</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}