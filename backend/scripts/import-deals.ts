// Import all Fireberry deals (AccountProduct, type 33) into crm_deals.
// Each Fireberry deal becomes a crm_deals row linked to the student contact
// (matched by fireberry_account_id) and to a CRM product matched by name.
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

function normalizeDate(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString();
}
function dateOnly(v: any): string | null {
  const s = normalizeDate(v); return s ? s.slice(0, 10) : null;
}
function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v); return isFinite(n) ? n : null;
}

(async () => {
  console.log(`Fireberry deals → crm_deals`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Team members (ownername → id)
  const { data: tm } = await sb.from("crm_team_members").select("id, display_name");
  const teamByName: Record<string, string> = {};
  for (const t of tm || []) if (t.display_name) teamByName[t.display_name] = t.id;
  for (const [fbN, crmN] of Object.entries(OWNER_ALIASES)) if (teamByName[crmN]) teamByName[fbN] = teamByName[crmN];

  // 2. Products (name → id)
  const { data: products } = await sb.from("crm_products").select("id, name");
  const productByName: Record<string, string> = {};
  for (const p of products || []) if (p.name) productByName[p.name] = p.id;

  // 3. Pipelines / stages — pick won/lost stage per pipeline
  const { data: stages } = await sb.from("crm_pipeline_stages").select("id, pipeline_id, name, is_won, is_lost");
  // First "won" / "lost" stage per pipeline
  const wonStageByPipeline: Record<string, string> = {};
  const lostStageByPipeline: Record<string, string> = {};
  for (const s of stages || []) {
    if (!s.pipeline_id) continue;
    if (s.is_won && !wonStageByPipeline[s.pipeline_id]) wonStageByPipeline[s.pipeline_id] = s.id;
    if (s.is_lost && !lostStageByPipeline[s.pipeline_id]) lostStageByPipeline[s.pipeline_id] = s.id;
  }
  // Default pipeline (first one we have stages for)
  const defaultPipelineId = Object.keys(wonStageByPipeline)[0] || (stages || [])[0]?.pipeline_id;

  // 4. Contacts — index by fireberry_account_id and fireberry_opportunity_id
  const byAccount: Record<string, { id: string; stage_id: string | null }> = {};
  const byOpp: Record<string, { id: string; stage_id: string | null }> = {};
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts")
      .select("id, custom_fields, stage_id").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const cf = r.custom_fields as any || {};
      if (cf.fireberry_account_id) byAccount[cf.fireberry_account_id] = { id: r.id, stage_id: r.stage_id };
      if (cf.fireberry_opportunity_id) byOpp[cf.fireberry_opportunity_id] = { id: r.id, stage_id: r.stage_id };
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Lookups: ${Object.keys(byAccount).length} accounts, ${Object.keys(byOpp).length} opps`);

  // Stage → pipeline lookup
  const pipelineByStage: Record<string, string> = {};
  for (const s of stages || []) if (s.pipeline_id) pipelineByStage[s.id] = s.pipeline_id;

  // 5. Existing imported deals (skip duplicates by Fireberry id stored in custom_fields)
  const { data: existingDeals } = await sb.from("crm_deals").select("custom_fields");
  const existingFbIds = new Set<string>();
  for (const d of existingDeals || []) {
    const fid = (d.custom_fields as any)?.fireberry_deal_id;
    if (fid) existingFbIds.add(fid);
  }
  console.log(`Already imported: ${existingFbIds.size}`);

  // 6. Fetch all Fireberry deals
  const deals = await fb.queryAll<any>(33, "*");
  console.log(`Fetched deals: ${deals.length}`);

  function pickProduct(productname: string | undefined): string | null {
    if (!productname) return null;
    const exact = productByName[productname];
    if (exact) return exact;
    const lc = productname.toLowerCase();
    for (const [name, id] of Object.entries(productByName)) {
      if (name.toLowerCase().includes(lc) || lc.includes(name.toLowerCase())) return id;
    }
    return null;
  }

  function mapStatus(paymentStatus: string | undefined): "won" | "lost" | "open" {
    if (paymentStatus === "בוטל") return "lost";
    if (paymentStatus === "שולם" || paymentStatus === "שולם באופן חלקי") return "won";
    return "open";
  }

  const rows: any[] = [];
  let skipExisting = 0, skipNoContact = 0;
  for (const d of deals) {
    if (existingFbIds.has(d.accountproductid)) { skipExisting++; continue; }
    const contact = byAccount[d.accountid] || byOpp[d.pcfsystemfield196];
    if (!contact) { skipNoContact++; continue; }

    const pipelineId = (contact.stage_id && pipelineByStage[contact.stage_id]) || defaultPipelineId;
    if (!pipelineId) continue;
    const status = mapStatus(d.pcfsystemfield56name);
    let stageId: string | null = null;
    if (status === "won") stageId = wonStageByPipeline[pipelineId] || null;
    else if (status === "lost") stageId = lostStageByPipeline[pipelineId] || null;
    else stageId = contact.stage_id;
    if (!stageId) continue;

    const productId = pickProduct(d.productname);
    const installDate = dateOnly(d.installdate) || dateOnly(d.pcfsystemfield129) || dateOnly(d.createdon);

    // value = actual cash received (excluded for cancelled deals).
    // The original agreed price is preserved in custom_fields.deal_amount.
    const actualPaid = num(d.pcfsystemfield160) || 0;
    const dealValueForCash = status === "lost" ? 0 : actualPaid;
    rows.push({
      contact_id: contact.id,
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: [d.productname, d.accountname].filter(Boolean).join(" — ") || "עסקה",
      value: dealValueForCash,
      currency: "ILS",
      status,
      product_id: productId,
      assigned_to: teamByName[d.ownername] || null,
      expected_close: installDate,
      actual_close: status === "won" ? installDate : null,
      loss_reason: status === "lost" ? (d.pcfsystemfield195 || null) : null,
      notes: d.description || null,
      created_at: normalizeDate(d.createdon),
      updated_at: normalizeDate(d.modifiedon),
      custom_fields: {
        fireberry_deal_id: d.accountproductid,
        fireberry_account_id: d.accountid,
        fireberry_opportunity_id: d.pcfsystemfield196 || null,
        fireberry_linked_webinar: d.pcfsystemfield197name || null,
        payment_status: d.pcfsystemfield56name || null,
        deal_amount: num(d.price) || 0,         // original agreed price
        actual_paid: actualPaid,                 // what came in
        total_paid: num(d.pcfsystemfield160),
        balance_due: num(d.pcfsystemfield162),
        payment_count: num(d.pcfsystemfield198),
        payments_made: num(d.pcfsystemfield201),
        cohort: d.pcfsystemfield53name || null,
        cancellation_date: normalizeDate(d.pcfsystemfield202),
        cancellation_reason: d.pcfsystemfield195 || null,
        registration_number: d.ordinalnumber ? String(d.ordinalnumber) : null,
        last_lesson_date: normalizeDate(d.expiredate),
        repeat_course: d.pcfsystemfield166 || null,
      },
    });
  }

  console.log(`\nTo insert: ${rows.length}`);
  console.log(`Skipped (existing):    ${skipExisting}`);
  console.log(`Skipped (no contact):  ${skipNoContact}`);

  // Distribution
  const sumByStatus = rows.reduce((acc: any, r) => { acc[r.status] = (acc[r.status] || 0) + r.value; return acc; }, {});
  console.log(`\nValue by status:`);
  for (const [k, v] of Object.entries(sumByStatus)) console.log(`  ${k}: ₪${(v as number).toLocaleString()}`);
  const byProduct: Record<string, number> = {};
  const productNameById = new Map((products || []).map((p: any) => [p.id, p.name]));
  for (const r of rows) {
    const k = productNameById.get(r.product_id) || "(no product)";
    byProduct[k] = (byProduct[k] || 0) + 1;
  }
  console.log(`\nBy product:`);
  for (const [k, v] of Object.entries(byProduct)) console.log(`  ${k}: ${v}`);

  if (!DRY_RUN && rows.length) {
    let inserted = 0;
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await sb.from("crm_deals").insert(chunk);
      if (error) console.log(`  ! chunk ${i / CHUNK}: ${error.message}`);
      else inserted += chunk.length;
    }
    console.log(`\nInserted: ${inserted}/${rows.length}`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
