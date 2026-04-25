import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ContactEventRegistration {
  contact_id: string;
  event_id: string;
  event_title: string;
  event_scheduled_at: string;
  event_type: "webinar" | "live_community" | "workshop";
  registered: boolean;
  attended: boolean;
}

// Fetch all event registrations + their event info, indexed by contact_id.
// Used by the contacts list to render webinar columns as links.
export function useEventRegistrationsByContact() {
  return useQuery({
    queryKey: ["event_registrations_by_contact"],
    queryFn: async () => {
      // PostgREST cap is 1000 rows — paginate.
      const PAGE = 1000;
      const all: any[] = [];
      for (let p = 0; p < 20; p++) {
        const { data, error } = await supabase
          .from("crm_event_registrations")
          .select("contact_id,event_id,registered,attended,event:crm_events(id,title,scheduled_at,event_type)")
          .range(p * PAGE, (p + 1) * PAGE - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }

      const byContact = new Map<string, ContactEventRegistration[]>();
      for (const r of all) {
        const ev = (r as any).event;
        if (!ev) continue;
        const row: ContactEventRegistration = {
          contact_id: r.contact_id,
          event_id: r.event_id,
          event_title: ev.title,
          event_scheduled_at: ev.scheduled_at,
          event_type: ev.event_type,
          registered: r.registered,
          attended: r.attended,
        };
        const list = byContact.get(r.contact_id) || [];
        list.push(row);
        byContact.set(r.contact_id, list);
      }
      return byContact;
    },
    staleTime: 60_000,
  });
}
