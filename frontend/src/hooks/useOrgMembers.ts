import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import * as membersApi from "../api/members";
import { ROLE_RANK, type Member, type Role } from "../api/members";

export function useOrgMembers(orgId: string | undefined) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!orgId) return;
    membersApi.listMembers(orgId).then(setMembers).catch(() => setMembers([]));
  }, [orgId]);

  const me = members.find((m) => m.userId?._id === user?.id);
  const myRole: Role | null = me?.role ?? null;

  return {
    members,
    myRole,
    canWrite: myRole !== null && ROLE_RANK[myRole] >= ROLE_RANK.contributor,
    canDelete: myRole !== null && ROLE_RANK[myRole] >= ROLE_RANK.lead,
  };
}