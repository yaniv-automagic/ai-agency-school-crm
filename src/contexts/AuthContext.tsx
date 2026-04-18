import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { TeamMember, PermissionsMap, RolePermission, CrmAction } from "@/types/crm";

interface AuthState {
  user: User | null;
  session: Session | null;
  teamMember: TeamMember | null;
  permissions: PermissionsMap | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function buildPermissionsMap(rows: RolePermission[]): PermissionsMap {
  const map = {} as PermissionsMap;
  for (const row of rows) {
    map[row.entity] = {
      create: row.can_create,
      read: row.can_read,
      update: row.can_update,
      delete: row.can_delete,
    };
  }
  return map;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMap | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeamMember = async (userId: string) => {
    const { data } = await supabase
      .from("crm_team_members")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();
    const member = data as TeamMember | null;
    setTeamMember(member);
    if (member) {
      await fetchPermissions(member);
    }
  };

  const fetchPermissions = async (member: TeamMember) => {
    // Fetch permissions for this role - tenant-specific first, then global defaults
    const { data } = await supabase
      .from("crm_role_permissions")
      .select("*")
      .eq("role", member.role)
      .or(`tenant_id.eq.${member.tenant_id},tenant_id.is.null`)
      .order("tenant_id", { ascending: false, nullsFirst: false });

    if (data && data.length > 0) {
      // Tenant-specific overrides come first (non-null tenant_id), then global defaults
      // Build map: tenant-specific wins over global
      const seen = new Set<string>();
      const effective: RolePermission[] = [];
      for (const row of data as RolePermission[]) {
        if (!seen.has(row.entity)) {
          seen.add(row.entity);
          effective.push(row);
        }
      }
      setPermissions(buildPermissionsMap(effective));
    }
  };

  const refreshPermissions = async () => {
    if (teamMember) {
      await fetchPermissions(teamMember);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchTeamMember(s.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          fetchTeamMember(s.user.id);
        } else {
          setTeamMember(null);
          setPermissions(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTeamMember(null);
    setPermissions(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, teamMember, permissions, loading, signIn, signOut, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
