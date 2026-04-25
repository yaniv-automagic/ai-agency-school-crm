// Create crm_program_enrollments for all students (Fireberry Account holders).
// Maps Fireberry service_track / lead track to a product, and the account's
// activity status to enrollment status.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");

(async () => {
  console.log(`Create student enrollments`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Products
  const { data: products } = await sb.from("crm_products").select("id, name");
  const productByKeyword = new Map<string, string>();
  for (const p of products || []) {
    const name = (p.name || "").toLowerCase();
    if (name.includes("דיגיטלי")) productByKeyword.set("digital", p.id);
    if (name.includes("בסיסית") || name.includes("3 חודשים")) productByKeyword.set("basic", p.id);
    if (name.includes("פרימיום") || name.includes("6 חודשים")) productByKeyword.set("premium", p.id);
  }
  console.log(`Products: ${[...productByKeyword.entries()].map(([k,v]) => `${k}=${v.slice(0,8)}`).join(", ")}`);
  if (productByKeyword.size === 0) {
    console.log("No products found. Aborting.");
    return;
  }

  // 2. Fetch all contacts tagged 'student' with student custom_fields
  const studentContacts: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("crm_contacts")
      .select("id, status, tags, custom_fields, assigned_to")
      .contains("tags", ["student"])
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    studentContacts.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Student contacts: ${studentContacts.length}`);

  // 3. Existing enrollments to skip
  const { data: existing } = await sb
    .from("crm_program_enrollments")
    .select("contact_id");
  const existingByContact = new Set((existing || []).map(e => e.contact_id));
  console.log(`Existing enrollments: ${existingByContact.size}`);

  // 4. Team members (mentor name lookup)
  const { data: tm } = await sb.from("crm_team_members").select("id, display_name");
  const memberById = new Map<string, string>();
  for (const t of tm || []) if (t.display_name) memberById.set(t.id, t.display_name);

  // 5. Build enrollment rows
  function pickProduct(cf: any): string | null {
    const track = (cf.service_track || cf.track || "").toLowerCase();
    const cohort = (cf.cohort || "").toLowerCase();
    // "קורס דיגיטלי" → digital
    if (track.includes("דיגיטלי")) return productByKeyword.get("digital") || null;
    // Lead's track (pcfsystemfield116name): "הכשרת פרימיום 6 חודשים" / "הכשרה בסיסית 3 חודשים"
    if (track.includes("פרימיום") || track.includes("6 חודשים")) return productByKeyword.get("premium") || null;
    if (track.includes("בסיסית") || track.includes("3 חודשים")) return productByKeyword.get("basic") || null;
    if (cohort.includes("פרימיום")) return productByKeyword.get("premium") || null;
    if (cohort.includes("בסיסית")) return productByKeyword.get("basic") || null;
    // "פיילוטים חינמיים" / "סטנדרטי" — assume basic 3-month
    if (track.includes("פיילוטים") || track.includes("סטנדרטי")) return productByKeyword.get("basic") || null;
    // Default: basic
    return productByKeyword.get("basic") || null;
  }

  const enrollmentRows: any[] = [];
  let skipExisting = 0, skipNoProduct = 0;
  for (const c of studentContacts) {
    if (existingByContact.has(c.id)) { skipExisting++; continue; }
    const cf = c.custom_fields || {};
    const productId = pickProduct(cf);
    if (!productId) { skipNoProduct++; continue; }

    // Determine status:
    //   account פעיל → student (active)
    //   account לא פעיל → alumni (completed/cancelled depending on lost_reason)
    let status = "active";
    if (c.status === "alumni") {
      const stage = (cf.mentoring_stage || "").toLowerCase();
      if (stage === "סיים") status = "completed";
      else if (stage === "בוטל" || cf.cancellation_date) status = "cancelled";
      else status = "completed"; // default for alumni
    } else if (cf.mentoring_stage === "ממתין ללקוח" || cf.mentoring_stage === "ממתין למנטור") {
      status = "pending";
    }

    const start = cf.mentoring_start ? cf.mentoring_start.slice(0, 10) : null;
    const end = cf.mentoring_end ? cf.mentoring_end.slice(0, 10) : null;
    const mentorName = c.assigned_to ? memberById.get(c.assigned_to) || null : null;

    enrollmentRows.push({
      contact_id: c.id,
      product_id: productId,
      status,
      start_date: start,
      end_date: end,
      total_sessions: Number(cf.mentoring_meeting_count) || 0,
      completed_sessions: 0,
      portal_access_granted: false,
      mentor_name: mentorName,
      notes: [
        cf.mentoring_stage && `שלב: ${cf.mentoring_stage}`,
        cf.service_track && `מסלול: ${cf.service_track}`,
        cf.chosen_niche && `נישה: ${cf.chosen_niche}`,
        cf.lost_reason && `סיבת סגירה: ${cf.lost_reason}`,
      ].filter(Boolean).join("\n") || null,
    });
  }

  console.log(`\nTo create: ${enrollmentRows.length}`);
  console.log(`Skipped (already enrolled): ${skipExisting}`);
  console.log(`Skipped (no product mapping): ${skipNoProduct}`);

  // Distribution
  const fromCounter = (arr: any[], k: string) => {
    const m: Record<string, number> = {};
    for (const r of arr) m[r[k] ?? "null"] = (m[r[k] ?? "null"] || 0) + 1;
    return m;
  };
  console.log("\nBy status:", fromCounter(enrollmentRows, "status"));
  const productNames = new Map((products || []).map((p: any) => [p.id, p.name]));
  const byProduct: Record<string, number> = {};
  for (const r of enrollmentRows) {
    const pname = productNames.get(r.product_id) || r.product_id;
    byProduct[pname] = (byProduct[pname] || 0) + 1;
  }
  console.log("By product:", byProduct);

  if (!DRY_RUN && enrollmentRows.length) {
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < enrollmentRows.length; i += CHUNK) {
      const chunk = enrollmentRows.slice(i, i + CHUNK);
      const { error } = await sb.from("crm_program_enrollments").insert(chunk);
      if (error) console.log(`  ! chunk ${i / CHUNK}: ${error.message}`);
      else inserted += chunk.length;
    }
    console.log(`\nInserted: ${inserted}/${enrollmentRows.length}`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
