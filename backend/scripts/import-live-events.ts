// Import Fireberry "לייב" community events (type 1007) into crm_events.
// Idempotent via external_id = customobject1007id.
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

function normalizeDate(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

(async () => {
  console.log(`Fireberry lives → crm_events`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  const lives = await fb.queryAll<any>(1007, "*");
  console.log(`Fetched lives: ${lives.length}`);

  const rows: any[] = [];
  for (const l of lives) {
    const startAt = normalizeDate(l.pcfsystemfield100);
    if (!startAt) continue;
    const endAt = normalizeDate(l.pcfsystemfield107);
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : null;
    const durationMin = end ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) : 60;
    const now = Date.now();
    const status = start.getTime() > now ? "upcoming" : "completed";

    rows.push({
      event_type: "live_community",
      title: l.name || "לייב קהילתי",
      description: l.pcfsystemfield104 || null,
      scheduled_at: startAt,
      end_at: endAt,
      duration_minutes: durationMin,
      meeting_url: l.pcfsystemfield105 || null,
      status,
      registered_count: 0,
      attended_count: 0,
      notes: l.pcfsystemfield103 ? `מנחה: ${l.pcfsystemfield103}` : null,
      external_source: "fireberry",
      external_id: l.customobject1007id,
      created_at: normalizeDate(l.createdon),
    });
  }

  console.log(`To upsert: ${rows.length}`);
  if (rows.length) {
    console.log("\nSample:");
    for (const r of rows.slice(0, 3))
      console.log(`  ${r.scheduled_at.slice(0,16)}  ${r.title.slice(0,40)}  status=${r.status}  meet=${r.meeting_url ? "YES" : "no"}`);
  }

  if (!DRY_RUN && rows.length) {
    const { error } = await sb.from("crm_events").upsert(rows, { onConflict: "external_source,external_id" });
    if (error) console.log(`  ! upsert error: ${error.message}`);
    else console.log(`\nUpserted: ${rows.length}`);
  }

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
