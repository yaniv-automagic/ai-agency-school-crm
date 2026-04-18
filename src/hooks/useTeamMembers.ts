import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TeamMember } from "@/types/crm";

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("crm_team_members")
      .select("*")
      .eq("is_active", true)
      .order("display_name")
      .then(({ data }) => {
        setMembers((data as TeamMember[]) || []);
        setLoading(false);
      });
  }, []);

  return { members, loading };
}
