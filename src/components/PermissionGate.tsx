import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { CrmEntity, CrmAction } from "@/types/crm";

interface PermissionGateProps {
  entity: CrmEntity;
  action: CrmAction;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PermissionGate({ entity, action, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermissions();

  if (!can(action, entity)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
