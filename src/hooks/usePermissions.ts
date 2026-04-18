import { useAuth } from "@/contexts/AuthContext";
import type { CrmEntity, CrmAction } from "@/types/crm";

export function usePermissions() {
  const { permissions, teamMember } = useAuth();

  const can = (action: CrmAction, entity: CrmEntity): boolean => {
    if (!teamMember || !permissions) return false;
    // Owner always has full access as a safety net
    if (teamMember.role === "owner") return true;
    const entityPerms = permissions[entity];
    if (!entityPerms) return false;
    return entityPerms[action] ?? false;
  };

  const canAny = (entity: CrmEntity): boolean => {
    return can("create", entity) || can("read", entity) || can("update", entity) || can("delete", entity);
  };

  const isOwnerOrAdmin = teamMember?.role === "owner" || teamMember?.role === "admin";

  return { can, canAny, isOwnerOrAdmin, permissions };
}
