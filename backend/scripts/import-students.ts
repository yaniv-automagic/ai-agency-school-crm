// Import / refresh student data from Fireberry Accounts (object type 1).
// Each Account becomes a CRM contact with status='student' (active) or
// 'alumni' (inactive), assigned to the mentor, with full mentoring metadata
// stored in custom_fields.
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
function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

(async () => {
  console.log(`Fireberry students → CRM`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Team members (ownername → id)
  const { data: tm } = await sb.from("crm_team_members").select("id, display_name");
  const teamByName: Record<string, string> = {};
  for (const t of tm || []) if (t.display_name) teamByName[t.display_name] = t.id;
  for (const [fb, crm] of Object.entries(OWNER_ALIASES)) if (teamByName[crm]) teamByName[fb] = teamByName[crm];

  // 2. Fetch all accounts with rich student fields
  const fields = [
    "accountid", "accountname", "firstname", "lastname",
    "emailaddress1", "emailaddress2", "telephone1", "telephone2",
    "idnumber", "birthdaydate", "billingstreet", "billingcity",
    "createdon", "modifiedon", "ownername", "statuscode", "lostreason", "description",
    // Student-specific
    "accountnumber",                    // student id
    "pcfsystemfield212",                // mentoring type
    "pcfsystemfield215",                // # meetings
    "pcfsystemfield218",                // monthly revenue
    "pcfsystemfield222",                // mentoring start
    "pcfsystemfield223",                // mentoring end
    "pcfsystemfield227",                // mentoring stage/status
    "pcfsystemfield229",                // days remaining
    "pcfsystemfield231",                // total revenue since training
    "pcfsystemfield232",                // LTV
    "pcfsystemfield233",                // referrals closed
    "pcfsystemfield234",                // recommendations closed
    "pcfsystemfield236",                // chosen niche
    "pcfsystemfield242",                // cancellation date
    "pcfsystemfield244",                // service track
    "pcfsystemfield246",                // last meeting date
    "pcfsystemfield247",                // linked workshop
    "revenue",
  ].join(",");
  const accounts = await fb.queryAll<any>(1, fields);
  console.log(`Fetched accounts: ${accounts.length}`);

  // 3. CRM contact lookups
  const byEmail = new Map<string, { id: string; custom: any; tags: string[] | null }>();
  const byPhone = new Map<string, { id: string; custom: any; tags: string[] | null }>();
  const byFbAccount = new Map<string, { id: string; custom: any; tags: string[] | null }>();
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts")
      .select("id, email, phone, custom_fields, tags").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const rec = { id: r.id, custom: r.custom_fields || {}, tags: r.tags || [] };
      if (r.email) byEmail.set(r.email.toLowerCase(), rec);
      if (r.phone) byPhone.set(r.phone, rec);
      const acctId = (r.custom_fields as any)?.fireberry_account_id;
      if (acctId) byFbAccount.set(acctId, rec);
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  let updates = 0, inserts = 0, skipped = 0;
  const insertRows: any[] = [];
  const updatePatches: Array<{ id: string; patch: any }> = [];

  for (const a of accounts) {
    const email = normalizeEmail(a.emailaddress1) || normalizeEmail(a.emailaddress2);
    const phone = normalizePhone(a.telephone1) || normalizePhone(a.telephone2);

    const existing = byFbAccount.get(a.accountid)
      || (email && byEmail.get(email))
      || (phone && byPhone.get(phone))
      || null;

    const isActive = a.statuscode === "פעיל";
    const status = isActive ? "student" : "alumni";

    // Split name (account often has only fullname in `accountname`)
    const fullName = (a.accountname || "").trim();
    const parts = fullName.split(/\s+/);
    const firstName = (a.firstname || parts[0] || "תלמיד").trim();
    const lastName = (a.lastname || parts.slice(1).join(" ") || "").trim();

    const studentCustom = {
      fireberry_account_id: a.accountid,
      fireberry_account_name: a.accountname,
      fireberry_account_status: a.statuscode,
      student_number: a.accountnumber || null,
      mentoring_start: normalizeDate(a.pcfsystemfield222),
      mentoring_end: normalizeDate(a.pcfsystemfield223),
      mentoring_stage: a.pcfsystemfield227 || null,
      service_track: a.pcfsystemfield244 || null,
      mentoring_meeting_count: num(a.pcfsystemfield215),
      mentoring_days_remaining: num(a.pcfsystemfield229),
      last_mentoring_meeting: normalizeDate(a.pcfsystemfield246),
      chosen_niche: a.pcfsystemfield236 || null,
      monthly_revenue: num(a.pcfsystemfield218),
      total_revenue: num(a.pcfsystemfield231) || num(a.revenue),
      ltv: num(a.pcfsystemfield232),
      referrals_closed: num(a.pcfsystemfield233),
      recommendations_closed: num(a.pcfsystemfield234),
      cancellation_date: normalizeDate(a.pcfsystemfield242),
      lost_reason: a.lostreason || null,
      linked_workshop: a.pcfsystemfield247 || null,
      account_imported_at: new Date().toISOString(),
    };

    const mentorId = teamByName[a.ownername] || null;

    if (existing) {
      const tags = new Set<string>(existing.tags || []);
      tags.add("fireberry");
      tags.add("student");
      if (status === "alumni") tags.add("alumni");
      const patch: any = {
        status,
        assigned_to: mentorId || (existing.custom as any)?.assigned_to,
        tags: [...tags],
        custom_fields: { ...(existing.custom || {}), ...studentCustom },
      };
      if (a.idnumber && !(existing.custom as any)?.id_number_set) patch.id_number = a.idnumber;
      updatePatches.push({ id: existing.id, patch });
      updates++;
    } else {
      // No CRM contact — should be rare since earlier import created any unmatched
      const tags = ["fireberry", "student"];
      if (status === "alumni") tags.push("alumni");
      insertRows.push({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        whatsapp_phone: phone,
        id_number: a.idnumber || null,
        address: [a.billingstreet, a.billingcity].filter(Boolean).join(", ") || null,
        status,
        source: "import",
        tags,
        marketing_consent: true,
        marketing_consent_at: normalizeDate(a.createdon),
        created_at: normalizeDate(a.createdon),
        assigned_to: mentorId,
        custom_fields: studentCustom,
      });
      inserts++;
    }
  }

  console.log(`To update: ${updates}, to insert: ${inserts}, skipped: ${skipped}`);

  if (!DRY_RUN) {
    let okU = 0;
    for (const u of updatePatches) {
      const { error } = await sb.from("crm_contacts").update(u.patch).eq("id", u.id);
      if (!error) okU++;
      else console.log(`  ! ${u.id.slice(0,8)}: ${error.message}`);
    }
    console.log(`Updated: ${okU}/${updates}`);

    if (insertRows.length) {
      const { data, error } = await sb.from("crm_contacts").insert(insertRows).select("id");
      if (error) console.log(`  ! insert: ${error.message}`);
      else console.log(`Inserted: ${data?.length || 0}/${inserts}`);
    }
  } else if (updatePatches.length) {
    console.log("\nSample update:");
    const s = updatePatches[0];
    console.log(`  id=${s.id.slice(0,8)} status→${s.patch.status} assigned_to→${s.patch.assigned_to?.slice(0,8) || "null"}`);
    console.log(`  custom_fields keys: ${Object.keys(s.patch.custom_fields).slice(0, 8).join(", ")}...`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
