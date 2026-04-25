// Fix sales-meeting statuses using the Lead's own "סטטוס פגישה" field
// (pcfsystemfield103name) on the Fireberry Opportunity. This field is the
// authoritative outcome on the lead; the Activity status (which we used
// originally) often stays as "נקבעה" even after the meeting concluded.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FireberryClient } from "./fireberry-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(join(__dirname, "..", ".env"));
loadEnvFile(join(__dirname, "..", "..", ".env"));

const fb = new FireberryClient(process.env.FIREBERRY_TOKEN_ID!);
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");

function mapLeadMeetingStatus(s: string | undefined, scheduledAt: string | null): string | null {
  switch (s) {
    case "התקיימה":     return "completed";
    case "לא התקיימה":  return "no_show";
    case "נקבעה":
      // If the date is in the future, scheduled is correct.
      // If past, leave it (caller will skip — already-resolved meetings shouldn't go back).
      if (scheduledAt && new Date(scheduledAt).getTime() > Date.now()) return "scheduled";
      return null;
    case "לא נקבעה":    return null; // no meeting expected
    default:             return null;
  }
}

(async () => {
  console.log(`Fix meeting statuses from lead's pcfsystemfield103name`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Fireberry leads with meeting status + date
  const leads = await fb.queryAll<any>(4, "opportunityid,pcfsystemfield103name,pcfsystemfield125");
  const leadIndex: Record<string, { status: string | undefined; date: string | undefined }> = {};
  for (const l of leads) {
    leadIndex[l.opportunityid] = { status: l.pcfsystemfield103name, date: l.pcfsystemfield125 };
  }
  console.log(`Fireberry leads: ${leads.length}`);

  // 2. CRM contacts with fireberry_opportunity_id
  const oppToContact: Record<string, string> = {};
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts").select("id, custom_fields").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const oid = (r.custom_fields as any)?.fireberry_opportunity_id;
      if (oid) oppToContact[oid] = r.id;
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Contacts mapped to opportunities: ${Object.keys(oppToContact).length}`);

  // 3. All sales-meetings indexed by contact_id
  const meetingsByContact: Record<string, Array<{ id: string; scheduled_at: string; status: string }>> = {};
  let mfrom = 0;
  while (true) {
    const { data, error } = await sb
      .from("crm_meetings")
      .select("id, contact_id, scheduled_at, status, meeting_type")
      .eq("meeting_type", "sales_consultation")
      .range(mfrom, mfrom + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const m of data) {
      if (!m.contact_id) continue;
      (meetingsByContact[m.contact_id] = meetingsByContact[m.contact_id] || []).push({
        id: m.id, scheduled_at: m.scheduled_at, status: m.status,
      });
    }
    if (data.length < 1000) break;
    mfrom += 1000;
  }
  const totalMeetings = Object.values(meetingsByContact).reduce((a, b) => a + b.length, 0);
  console.log(`Sales meetings: ${totalMeetings} across ${Object.keys(meetingsByContact).length} contacts`);

  // 4. For each lead with status — pick the contact's meeting closest to the lead's meeting date
  let updateCount = 0, noContactCount = 0, noMeetingCount = 0, sameStatusCount = 0;
  const updates: Array<{ id: string; from: string; to: string; leadStatus: string }> = [];
  const usedMeetingIds = new Set<string>();

  for (const [oppId, info] of Object.entries(leadIndex)) {
    if (!info.status) continue;
    const target = mapLeadMeetingStatus(info.status, info.date || null);
    if (!target) continue;

    const contactId = oppToContact[oppId];
    if (!contactId) { noContactCount++; continue; }

    const meetings = meetingsByContact[contactId] || [];
    if (meetings.length === 0) { noMeetingCount++; continue; }

    // Pick meeting closest to lead's meeting date (or first if no date)
    let chosen = meetings[0];
    if (info.date) {
      const targetMs = new Date(info.date).getTime();
      let bestDiff = Infinity;
      for (const m of meetings) {
        if (usedMeetingIds.has(m.id)) continue;
        const diff = Math.abs(new Date(m.scheduled_at).getTime() - targetMs);
        if (diff < bestDiff) { bestDiff = diff; chosen = m; }
      }
    } else {
      const free = meetings.find(m => !usedMeetingIds.has(m.id));
      if (free) chosen = free;
    }
    usedMeetingIds.add(chosen.id);

    if (chosen.status === target) { sameStatusCount++; continue; }
    updates.push({ id: chosen.id, from: chosen.status, to: target, leadStatus: info.status });
    updateCount++;
  }

  // Status transition stats
  const transitions = new Map<string, number>();
  for (const u of updates) {
    const k = `${u.from} → ${u.to}  (lead: ${u.leadStatus})`;
    transitions.set(k, (transitions.get(k) || 0) + 1);
  }
  console.log(`\nUpdates planned: ${updates.length}`);
  console.log(`No contact:      ${noContactCount}`);
  console.log(`No meeting:      ${noMeetingCount}`);
  console.log(`Status already correct: ${sameStatusCount}`);
  console.log("\nTransitions:");
  for (const [k, v] of [...transitions.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);

  if (!DRY_RUN && updates.length) {
    let ok = 0;
    for (const u of updates) {
      const { error } = await sb.from("crm_meetings").update({ status: u.to }).eq("id", u.id);
      if (!error) ok++;
      else console.log(`  ! ${u.id.slice(0,8)}: ${error.message}`);
    }
    console.log(`\nUpdated: ${ok}/${updates.length}`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
