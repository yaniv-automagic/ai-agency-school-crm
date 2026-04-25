// One-shot: import Fireberry activities (type 6) whose objectid points to an Account (type 1).
// Maps Account → CRM contact via email/phone, then creates timeline entries.
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
function mapStatus(s: string | undefined): string {
  switch (s) {
    case "נקבעה": return "scheduled";
    case "התקיימה": return "completed";
    case "בוטלה": return "cancelled";
    case "נדחתה לבקשת לקוח": return "rescheduled";
    case "לקוח לא עלה": return "no_show";
    default: return "scheduled";
  }
}

(async () => {
  console.log(`Fireberry Account-meetings → CRM timeline`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Team members
  const { data: tm } = await sb.from("crm_team_members").select("id, display_name");
  const teamByName: Record<string, string> = {};
  for (const t of tm || []) if (t.display_name) teamByName[t.display_name] = t.id;
  for (const [fb, crm] of Object.entries(OWNER_ALIASES)) if (teamByName[crm]) teamByName[fb] = teamByName[crm];

  // 2. Fetch all Fireberry Accounts with email/phone
  const accounts = await fb.queryAll<any>(1, "accountid,accountname,firstname,lastname,emailaddress1,emailaddress2,telephone1,telephone2");
  console.log(`Fetched ${accounts.length} accounts`);

  // 3. Build CRM contact lookup by email/phone
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts").select("id, email, phone").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
      if (r.phone) byPhone.set(r.phone, r.id);
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`CRM lookup: ${byEmail.size} emails, ${byPhone.size} phones`);

  // 4. Build Account → contact_id map
  const accountToContact: Record<string, string> = {};
  let matched = 0, unmatched = 0;
  for (const a of accounts) {
    const email = normalizeEmail(a.emailaddress1) || normalizeEmail(a.emailaddress2);
    const phone = normalizePhone(a.telephone1) || normalizePhone(a.telephone2);
    let cid = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
    if (cid) { accountToContact[a.accountid] = cid; matched++; }
    else unmatched++;
  }
  console.log(`Accounts matched to CRM contact: ${matched}, unmatched: ${unmatched}`);

  // 5. Fetch all activities, filter to those whose objectid is an Account
  const activities = await fb.queryAll<any>(6, "*");
  const acctIds = new Set(accounts.map(a => a.accountid));
  const acctActivities = activities.filter(a => a.objectid && acctIds.has(a.objectid));
  console.log(`Activities pointing to Accounts: ${acctActivities.length} (of ${activities.length} total)`);

  // 6. Existing fireberry_activity_ids (skip duplicates)
  const existingIds = new Set<string>();
  let from2 = 0;
  while (true) {
    const { data, error } = await sb.from("crm_activities")
      .select("metadata")
      .eq("metadata->>source", "fireberry")
      .range(from2, from2 + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const id = (r.metadata as any)?.fireberry_activity_id;
      if (id) existingIds.add(id);
    }
    if (data.length < 1000) break;
    from2 += 1000;
  }
  console.log(`Existing fireberry activities in DB: ${existingIds.size}`);

  // 7. Build timeline rows
  const rows: any[] = [];
  let skippedNoMatch = 0, skippedExisting = 0;
  for (const a of acctActivities) {
    if (existingIds.has(a.activityid)) { skippedExisting++; continue; }
    const contactId = accountToContact[a.objectid];
    if (!contactId) { skippedNoMatch++; continue; }
    const scheduledAt = normalizeDate(a.scheduledstart);
    rows.push({
      contact_id: contactId,
      type: "meeting",
      subject: a.subject || "פגישה",
      body: null,
      metadata: {
        source: "fireberry",
        fireberry_activity_id: a.activityid,
        fireberry_object_type: "account",
        status: mapStatus(a.status),
        raw_status: a.status,
        scheduled_start: scheduledAt,
        scheduled_end: normalizeDate(a.scheduledend),
        meeting_url: a.pcfsystemfield101 || null,
        recording_url: a.pcfsystemfield102 || null,
        priority: a.priority || null,
        location: a.location || null,
      },
      performed_by: teamByName[a.ownername] || null,
      performed_at: scheduledAt || normalizeDate(a.createdon),
    });
  }
  console.log(`To insert: ${rows.length}, skipped (already in DB): ${skippedExisting}, skipped (no matching contact): ${skippedNoMatch}`);

  if (!DRY_RUN && rows.length) {
    let inserted = 0, failed = 0;
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await sb.from("crm_activities").insert(chunk);
      if (error) {
        console.log(`  ! chunk ${i / CHUNK}: ${error.message}`);
        failed += chunk.length;
      } else inserted += chunk.length;
    }
    console.log(`\nInserted: ${inserted}, failed: ${failed}`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
