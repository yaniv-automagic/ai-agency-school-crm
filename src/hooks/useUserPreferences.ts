import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to persist user preferences in Supabase instead of localStorage.
 * Gracefully falls back to defaultValue if table doesn't exist or query fails.
 */
export function useUserPreference<T>(key: string, defaultValue: T) {
  const { teamMember } = useAuth();
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const userId = teamMember?.user_id;
  const tenantId = teamMember?.tenant_id;

  // Load from Supabase on mount
  useEffect(() => {
    if (!userId || !tenantId) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("crm_user_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .eq("key", key)
          .single();

        if (!error && data?.value !== undefined && data?.value !== null) {
          setValue(data.value as T);
        }
      } catch {
        // Table may not exist yet - use defaults silently
      }
      setLoaded(true);
    })();
  }, [userId, tenantId, key]);

  // Save to Supabase (debounced)
  const persist = useCallback(
    (newValue: T) => {
      setValue(newValue);

      if (!userId || !tenantId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        supabase.from("crm_user_preferences").upsert(
          {
            user_id: userId,
            tenant_id: tenantId,
            key,
            value: newValue as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,tenant_id,key" }
        ).then(() => {}, () => {});
      }, 500);
    },
    [userId, tenantId, key]
  );

  return [value, persist, loaded] as const;
}
