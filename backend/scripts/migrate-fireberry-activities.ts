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

const FIREBERRY_TOKEN = process.env.FIREBERRY_TOKEN_ID!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");

const fb = new FireberryClient(FIREBERRY_TOKEN);
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// Fireberry ownername → CRM display_name
const OWNER_ALIASES: Record<string, string> = { "ניצן טהר לב": "ניצן טהר-לב" };

function normalizeDate(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchTeamMembers(): Promise<Record<string, string>> {
  const { data, error } = await sb.from("crm_team_members").select("id, display_name");
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const m of data || []) if (m.display_name) map[m.display_name] = m.id;
  for (const [fb, crm] of Object.entries(OWNER_ALIASES)) if (map[crm]) map[fb] = map[crm];
  return map;
}

async function fetchContactsByFireberryOppId(): Promise<Record<string, { id: string; meetingSummary: string | null }>> {
  const map: Record<string, { id: string; meetingSummary: string | null }> = {};
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("crm_contacts")
      .select("id, custom_fields")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    for (const r of data) {
      const cf = (r.custom_fields || {}) as Record<string, any>;
      const oppId = cf.fireberry_opportunity_id;
      if (oppId) map[oppId] = { id: r.id, meetingSummary: cf.meeting_summary || null };
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

// Fireberry meeting status → crm_activities metadata
function mapStatus(status: string | undefined): string {
  switch (status) {
    case "נקבעה": return "scheduled";
    case "התקיימה": return "completed";
    case "בוטלה": return "cancelled";
    case "נדחתה לבקשת לקוח": return "rescheduled";
    case "לקוח לא עלה": return "no_show";
    default: return "scheduled";
  }
}

(async () => {
  console.log(`\nFireberry activities → CRM timeline`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  const teamMembers = await fetchTeamMembers();
  console.log(`Team members: ${Object.keys(teamMembers).length}`);

  const contactsByOpp = await fetchContactsByFireberryOppId();
  console.log(`Contacts with fireberry_opportunity_id: ${Object.keys(contactsByOpp).length}`);

  // === Stage 1: Fireberry Activities (meetings) ===
  console.log("\n== Activities ==");
  const activities = await fb.queryAll<any>(6, "*");
  console.log(`Fetched ${activities.length} activities from Fireberry`);

  const timelineRows: Array<{
    contact_id: string;
    type: string;
    subject: string;
    body: string | null;
    metadata: Record<string, any>;
    performed_by: string | null;
    performed_at: string | null;
  }> = [];
  let noContact = 0;

  for (const a of activities) {
    const oppId = a.objectid;
    if (!oppId) continue;
    const contact = contactsByOpp[oppId];
    if (!contact) { noContact++; continue; }

    const scheduledAt = normalizeDate(a.scheduledstart);
    const endAt = normalizeDate(a.scheduledend);
    const status = mapStatus(a.status);
    const meetUrl: string | null = a.pcfsystemfield101 || null;
    const recordingUrl: string | null = a.pcfsystemfield102 || null;

    timelineRows.push({
      contact_id: contact.id,
      type: "meeting",
      subject: a.subject || "פגישה",
      body: null,
      metadata: {
        source: "fireberry",
        fireberry_activity_id: a.activityid,
        status,
        raw_status: a.status,
        scheduled_start: scheduledAt,
        scheduled_end: endAt,
        meeting_url: meetUrl,
        recording_url: recordingUrl,
        priority: a.priority || null,
        location: a.location || null,
      },
      performed_by: teamMembers[a.ownername] || null,
      performed_at: scheduledAt || normalizeDate(a.createdon),
    });
  }
  console.log(`  matched to contact: ${timelineRows.length}`);
  console.log(`  no matching lead:   ${noContact}`);

  // === Stage 2: Meeting summaries (notes) ===
  console.log("\n== Meeting summaries (notes) ==");
  const summaryRows: typeof timelineRows = [];
  for (const [oppId, contact] of Object.entries(contactsByOpp)) {
    if (!contact.meetingSummary) continue;
    summaryRows.push({
      contact_id: contact.id,
      type: "note",
      subject: "סיכום פגישה",
      body: contact.meetingSummary,
      metadata: {
        source: "fireberry",
        kind: "meeting_summary",
        fireberry_opportunity_id: oppId,
      },
      performed_by: null,
      performed_at: null,
    });
  }
  console.log(`  notes to create: ${summaryRows.length}`);

  const allRows = [...timelineRows, ...summaryRows];
  console.log(`\nTotal timeline entries to insert: ${allRows.length}`);

  if (!DRY_RUN && allRows.length) {
    let inserted = 0, failed = 0;
    const CHUNK = 200;
    for (let i = 0; i < allRows.length; i += CHUNK) {
      const chunk = allRows.slice(i, i + CHUNK);
      const { error } = await sb.from("crm_activities").insert(chunk);
      if (error) {
        failed += chunk.length;
        console.log(`  ! chunk ${i / CHUNK}: ${error.message}`);
      } else {
        inserted += chunk.length;
      }
    }
    console.log(`\nInserted: ${inserted}, failed: ${failed}`);
  } else if (DRY_RUN) {
    console.log("\nDry run — sample rows:");
    for (const r of timelineRows.slice(0, 2))
      console.log(`  meeting: contact=${r.contact_id.slice(0, 8)} subject=${r.subject.slice(0, 40)} at=${r.performed_at?.slice(0, 10)}`);
    for (const r of summaryRows.slice(0, 2))
      console.log(`  note:    contact=${r.contact_id.slice(0, 8)} body=${r.body?.slice(0, 60)}`);
  }

  console.log("\n  Done.");
})().catch(err => {
  console.error("MIGRATION FAILED:", err);
  process.exit(1);
});
