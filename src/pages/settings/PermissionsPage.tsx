import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { TeamRole, CrmEntity, RolePermission } from "@/types/crm";
import { Switch } from "@/components/ui/switch";
import { Save, Shield } from "lucide-react";

const roles: TeamRole[] = ["owner", "admin", "sales", "marketing", "mentor", "viewer"];

const roleLabels: Record<TeamRole, string> = {
  owner: "בעלים",
  admin: "מנהל",
  sales: "מכירות",
  marketing: "שיווק",
  mentor: "מדריך",
  viewer: "צופה",
};

const entities: CrmEntity[] = [
  "contacts",
  "deals",
  "meetings",
  "tasks",
  "enrollments",
  "contracts",
  "campaigns",
  "automations",
  "products",
  "events",
  "finance",
  "settings",
  "users",
];

const entityLabels: Record<CrmEntity, string> = {
  contacts: "לידים / אנשי קשר",
  deals: "עסקאות",
  meetings: "פגישות",
  tasks: "משימות",
  enrollments: "הרשמות / תלמידים",
  contracts: "חוזים",
  campaigns: "קמפיינים",
  automations: "אוטומציות",
  products: "מוצרים",
  events: "אירועים",
  finance: "פיננסים",
  settings: "הגדרות",
  users: "משתמשים",
};

const actionLabels = {
  can_create: "יצירה",
  can_read: "צפייה",
  can_update: "עריכה",
  can_delete: "מחיקה",
};

type ActionKey = keyof typeof actionLabels;
const actionKeys: ActionKey[] = ["can_create", "can_read", "can_update", "can_delete"];

interface PermRow {
  role: TeamRole;
  entity: CrmEntity;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export default function PermissionsPage() {
  const { teamMember, refreshPermissions } = useAuth();
  const { isOwnerOrAdmin } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<TeamRole>("sales");
  const [permissions, setPermissions] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPermissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_role_permissions")
      .select("*")
      .eq("role", selectedRole)
      .or(`tenant_id.eq.${teamMember?.tenant_id},tenant_id.is.null`)
      .order("tenant_id", { ascending: false, nullsFirst: false });

    if (data) {
      // Build per-entity map, tenant-specific overrides global
      const seen = new Map<string, PermRow>();
      for (const row of data as RolePermission[]) {
        if (!seen.has(row.entity)) {
          seen.set(row.entity, {
            role: row.role as TeamRole,
            entity: row.entity as CrmEntity,
            can_create: row.can_create,
            can_read: row.can_read,
            can_update: row.can_update,
            can_delete: row.can_delete,
          });
        }
      }
      // Fill missing entities with defaults
      const result: PermRow[] = entities.map((entity) =>
        seen.get(entity) || {
          role: selectedRole,
          entity,
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false,
        }
      );
      setPermissions(result);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPermissions();
  }, [selectedRole]);

  const togglePermission = (entity: CrmEntity, action: ActionKey) => {
    if (selectedRole === "owner") return; // Owner permissions can't be changed
    setPermissions((prev) =>
      prev.map((row) =>
        row.entity === entity ? { ...row, [action]: !row[action] } : row
      )
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const perm of permissions) {
        await supabase
          .from("crm_role_permissions")
          .upsert(
            {
              tenant_id: teamMember?.tenant_id ?? null,
              role: selectedRole,
              entity: perm.entity,
              can_create: perm.can_create,
              can_read: perm.can_read,
              can_update: perm.can_update,
              can_delete: perm.can_delete,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,role,entity" }
          );
      }
      setSaved(true);
      await refreshPermissions();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error saving permissions:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Shield size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">אין לך הרשאה לצפות בדף זה</p>
        <p className="text-sm">רק בעלים ומנהלים יכולים לנהל הרשאות</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">הרשאות תפקידים</h1>
          <p className="text-muted-foreground text-sm">
            הגדרת הרשאות יצירה, צפייה, עריכה ומחיקה לכל אובייקט במערכת
          </p>
        </div>
        {selectedRole !== "owner" && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "שומר..." : saved ? "נשמר!" : "שמירת שינויים"}
          </button>
        )}
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              selectedRole === role
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {roleLabels[role]}
          </button>
        ))}
      </div>

      {selectedRole === "owner" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          לבעלים יש גישה מלאה לכל המערכת. לא ניתן לשנות הרשאות אלו.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground w-1/3">
                  אובייקט
                </th>
                {actionKeys.map((key) => (
                  <th key={key} className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                    {actionLabels[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {permissions.map((perm) => (
                <tr key={perm.entity} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm">
                    {entityLabels[perm.entity]}
                  </td>
                  {actionKeys.map((action) => (
                    <td key={action} className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={perm[action]}
                          onCheckedChange={() => togglePermission(perm.entity, action)}
                          disabled={selectedRole === "owner"}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
