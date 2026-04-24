import { supabase } from "./supabase";
import type { TeamMember, TeamRole } from "@/types/crm";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("לא מחובר. יש להתחבר מחדש.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function createTeamMember(params: {
  email: string;
  password: string;
  display_name: string;
  phone?: string;
  role: TeamRole;
  avatar_url?: string;
}): Promise<TeamMember> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/users/create`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `שגיאה ביצירת משתמש (${res.status})`);
  }
  return data.member as TeamMember;
}
