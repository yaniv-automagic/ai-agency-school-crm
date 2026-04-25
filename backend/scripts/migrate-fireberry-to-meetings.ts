// Import all Fireberry activities (type 6) as crm_meetings rows.
// Mirrors the timeline activities but stores rich meeting records (status,
// outcome, scheduled_at, meeting_url, recording_url).
//
// Idempotent: skips rows whose fillout_submission_id (used here as the
// fireberry_activity_id placeholder) already exist.
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
const OWNER_ALIASES: Record<string, string> = { "ניצן טהר לב": "ניצן טהר-לב" };

function normalizeEmail(v: any): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}
function normalizePhone(v: any): string | null {
  if (typeof v !== "string") return null;
  const d = v.replace(/\D/g, "");
  if (d.length < 7) return null;
  if (d.startsWith("972")) return "0" + d.slice(3);
  return d;
}
function normalizeDate(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function mapStatus(s: string | undefined): { status: string; outcome: string | null } {
  switch (s) {
    case "נקבעה":              return { status: "scheduled", outcome: null };
    case "התקיימה":            return { status: "completed", outcome: null };
    case "בוטלה":              return { status: "cancelled", outcome: null };
    case "נדחתה לבקשת לקוח":   return { status: "rescheduled", outcome: null };
    case "לקוח לא עלה":        return { status: "no_show", outcome: "no_show" };
    default:                   return { status: "scheduled", outcome: null };
  }
}

function durationMinutes(start: string | null, end: string | null): number {
  if (!start || !end) return 30;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!isFinite(ms) || ms <= 0) return 30;
  return Math.max(15, Math.round(ms / 60000));
}

(async () => {
  console.log(`Fireberry meetings → crm_meetings`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Team members for assigned_to lookup
  const { data: tm } = await sb.from("crm_team_members").select("id, display_name");
  const teamByName: Record<string, string> = {};
  for (const t of tm || []) if (t.display_name) teamByName[t.display_name] = t.id;
  for (const [fb, crm] of Object.entries(OWNER_ALIASES)) if (teamByName[crm]) teamByName[fb] = teamByName[crm];

  // 2. Build maps: opportunity_id → contact_id, account_id → contact_id
  console.log("Building lookup maps...");
  const oppToContact: Record<string, string> = {};
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts").select("id, custom_fields, email, phone").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const oid = (r.custom_fields as any)?.fireberry_opportunity_id;
      if (oid) oppToContact[oid] = r.id;
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  // Account → contact: via email/phone of Fireberry account
  const accounts = await fb.queryAll<any>(1, "accountid,emailaddress1,emailaddress2,telephone1,telephone2");
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  let f = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts").select("id, email, phone").range(f, f + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
      if (r.phone) byPhone.set(r.phone, r.id);
    }
    if (data.length < 1000) break;
    f += 1000;
  }
  const acctToContact: Record<string, string> = {};
  for (const a of accounts) {
    const email = normalizeEmail(a.emailaddress1) || normalizeEmail(a.emailaddress2);
    const phone = normalizePhone(a.telephone1) || normalizePhone(a.telephone2);
    const cid = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
    if (cid) acctToContact[a.accountid] = cid;
  }
  console.log(`  opp→contact: ${Object.keys(oppToContact).length}, account→contact: ${Object.keys(acctToContact).length}`);

  // 3. Existing meetings — skip if fillout_submission_id matches activityid
  const existingMeetingIds = new Set<string>();
  let fm = 0;
  while (true) {
    const { data, error } = await sb.from("crm_meetings").select("fillout_submission_id").range(fm, fm + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) if (r.fillout_submission_id) existingMeetingIds.add(r.fillout_submission_id);
    if (data.length < 1000) break;
    fm += 1000;
  }
  console.log(`  existing meetings (by fillout_submission_id): ${existingMeetingIds.size}`);

  // 4. Fetch all activities and build meeting rows
  const activities = await fb.queryAll<any>(6, "*");
  console.log(`  fetched ${activities.length} activities`);

  const rows: any[] = [];
  let skippedExisting = 0, skippedNoContact = 0;
  for (const a of activities) {
    if (existingMeetingIds.has(a.activityid)) { skippedExisting++; continue; }
    const contactId = oppToContact[a.objectid] || acctToContact[a.objectid];
    if (!contactId) { skippedNoContact++; continue; }

    const startAt = normalizeDate(a.scheduledstart) || normalizeDate(a.createdon);
    if (!startAt) continue; // crm_meetings.scheduled_at is NOT NULL
    const endAt = normalizeDate(a.scheduledend);
    const { status, outcome } = mapStatus(a.status);
    const isAccountMeeting = !oppToContact[a.objectid] && !!acctToContact[a.objectid];

    rows.push({
      contact_id: contactId,
      title: a.subject || "פגישה",
      description: null,
      meeting_type: isAccountMeeting ? "mentoring_1on1" : "sales_consultation",
      status,
      scheduled_at: startAt,
      duration_minutes: durationMinutes(startAt, endAt),
      meeting_url: a.pcfsystemfield101 || null,
      recording_url: a.pcfsystemfield102 || null,
      outcome,
      assigned_to: teamByName[a.ownername] || null,
      fillout_submission_id: a.activityid, // reuse this column as the Fireberry id key
    });
  }
  console.log(`  to insert: ${rows.length}, skip(existing): ${skippedExisting}, skip(no contact): ${skippedNoContact}`);

  if (!DRY_RUN && rows.length) {
    let inserted = 0, failed = 0;
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await sb.from("crm_meetings").insert(chunk);
      if (error) {
        console.log(`  ! chunk ${i / CHUNK}: ${error.message}`);
        failed += chunk.length;
      } else inserted += chunk.length;
    }
    console.log(`\nInserted: ${inserted}, failed: ${failed}`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
