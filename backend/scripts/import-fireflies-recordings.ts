// Bulk import Fireflies transcripts/recordings.
// For each Fireflies transcript:
//   1. find a matching crm_meeting by host email + scheduled_at proximity (±2h)
//   2. if none, find a matching contact by attendee email and create a meeting
//   3. update meeting with fireflies_meeting_id, transcript_url, recording_url, ai_summary
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
const FORCE_REIMPORT = args.has("--force");

async function fireflies(query: string, variables: any, apiKey: string) {
  const res = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  const data: any = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors).slice(0, 500));
  return data.data;
}

(async () => {
  console.log(`Fireflies → CRM recordings import`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Fireflies API key
  const { data: cfg } = await sb
    .from("crm_integration_configs")
    .select("config")
    .eq("provider", "fireflies")
    .eq("is_active", true)
    .maybeSingle();
  const apiKey = cfg?.config?.api_key;
  if (!apiKey) throw new Error("Fireflies API key missing in crm_integration_configs");
  console.log("API key: (set)");

  // 2. Pull all Fireflies transcripts (paginated, 50 per page)
  console.log("\nFetching transcripts from Fireflies...");
  const allTranscripts: any[] = [];
  let skip = 0;
  const PAGE = 50;
  while (true) {
    const data = await fireflies(`
      query($limit:Int!,$skip:Int!){
        transcripts(limit:$limit,skip:$skip){
          id title date duration host_email organizer_email
          transcript_url audio_url video_url
          meeting_attendees { email displayName name }
          summary { overview shorthand_bullet action_items }
        }
      }`, { limit: PAGE, skip }, apiKey);
    const batch = data?.transcripts || [];
    allTranscripts.push(...batch);
    console.log(`  page skip=${skip}: ${batch.length}`);
    if (batch.length < PAGE) break;
    skip += PAGE;
    if (skip > 5000) { console.log("  safety stop at 5000"); break; }
  }
  console.log(`Total transcripts: ${allTranscripts.length}`);

  // 3. Existing meetings already linked
  const { data: existing } = await sb
    .from("crm_meetings")
    .select("id, fireflies_meeting_id");
  const existingFf = new Set((existing || []).map(m => m.fireflies_meeting_id).filter(Boolean));
  console.log(`Already imported: ${existingFf.size}`);

  // 4. Build email → contact lookup
  const byEmail = new Map<string, string>();
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("crm_contacts").select("id, email").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Contact email index: ${byEmail.size}`);

  // 5. Team members (host_email → assigned_to)
  const { data: tm } = await sb.from("crm_team_members").select("id, email");
  const teamByEmail = new Map<string, string>();
  for (const t of tm || []) if (t.email) teamByEmail.set(t.email.toLowerCase(), t.id);

  // 6. Existing meetings indexed by (contact_id + day) for proximity-match
  const meetingsByContactDay = new Map<string, Array<{ id: string; scheduled_at: string }>>();
  let mfrom = 0;
  while (true) {
    const { data, error } = await sb
      .from("crm_meetings")
      .select("id, contact_id, scheduled_at")
      .range(mfrom, mfrom + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const m of data) {
      if (!m.contact_id || !m.scheduled_at) continue;
      const day = m.scheduled_at.slice(0, 10);
      const key = `${m.contact_id}|${day}`;
      const arr = meetingsByContactDay.get(key) || [];
      arr.push({ id: m.id, scheduled_at: m.scheduled_at });
      meetingsByContactDay.set(key, arr);
    }
    if (data.length < 1000) break;
    mfrom += 1000;
  }

  // 7. Process each transcript
  let updated = 0, created = 0, skippedExisting = 0, skippedNoContact = 0, skippedNoDate = 0;
  const newMeetings: any[] = [];
  const updates: Array<{ id: string; patch: any }> = [];

  for (const t of allTranscripts) {
    if (existingFf.has(t.id) && !FORCE_REIMPORT) { skippedExisting++; continue; }
    if (!t.date) { skippedNoDate++; continue; }

    // Find matching contact: any attendee that isn't a host/team member
    const teamEmails = new Set([...teamByEmail.keys()]);
    const attendeeEmails: string[] = [t.host_email, t.organizer_email,
      ...(t.meeting_attendees || []).map((a: any) => a.email)]
      .filter(Boolean).map(e => String(e).toLowerCase().trim());
    const externalEmails = attendeeEmails.filter(e => !teamEmails.has(e));

    let contactId: string | null = null;
    for (const e of externalEmails) {
      const cid = byEmail.get(e);
      if (cid) { contactId = cid; break; }
    }
    if (!contactId) { skippedNoContact++; continue; }

    // Find host's team member id
    const hostTeamId = teamByEmail.get(String(t.host_email || "").toLowerCase()) ||
                       teamByEmail.get(String(t.organizer_email || "").toLowerCase()) ||
                       null;

    const scheduledAt = new Date(t.date).toISOString();
    const day = scheduledAt.slice(0, 10);
    const candidates = meetingsByContactDay.get(`${contactId}|${day}`) || [];

    // Match by proximity (±2h)
    const tMs = new Date(scheduledAt).getTime();
    const match = candidates.find(c => Math.abs(new Date(c.scheduled_at).getTime() - tMs) <= 2 * 3600 * 1000);

    const summary = t.summary?.overview ||
      (Array.isArray(t.summary?.shorthand_bullet) ? t.summary.shorthand_bullet.join("\n") : t.summary?.shorthand_bullet) ||
      null;

    const patch = {
      fireflies_meeting_id: t.id,
      transcript_url: t.transcript_url || null,
      recording_url: t.video_url || t.audio_url || null,
      ai_summary: summary,
    };

    if (match) {
      updates.push({ id: match.id, patch });
    } else {
      newMeetings.push({
        contact_id: contactId,
        title: t.title || "פגישה",
        meeting_type: "sales_consultation",
        status: "completed",
        scheduled_at: scheduledAt,
        duration_minutes: t.duration ? Math.round(t.duration / 60) : 60,
        assigned_to: hostTeamId,
        ...patch,
      });
    }
  }

  console.log(`\nTo update existing meetings: ${updates.length}`);
  console.log(`To create new meetings:      ${newMeetings.length}`);
  console.log(`Skipped (already imported):  ${skippedExisting}`);
  console.log(`Skipped (no matching lead):  ${skippedNoContact}`);
  console.log(`Skipped (no date):           ${skippedNoDate}`);

  if (!DRY_RUN) {
    let updateOk = 0;
    for (const u of updates) {
      const { error } = await sb.from("crm_meetings").update(u.patch).eq("id", u.id);
      if (!error) updateOk++;
      else console.log(`  ! update ${u.id.slice(0,8)}: ${error.message}`);
    }
    console.log(`\nUpdated: ${updateOk}/${updates.length}`);

    if (newMeetings.length) {
      const CHUNK = 100;
      let insertOk = 0;
      for (let i = 0; i < newMeetings.length; i += CHUNK) {
        const chunk = newMeetings.slice(i, i + CHUNK);
        const { error } = await sb.from("crm_meetings").insert(chunk);
        if (error) console.log(`  ! insert chunk ${i / CHUNK}: ${error.message}`);
        else insertOk += chunk.length;
      }
      console.log(`Inserted: ${insertOk}/${newMeetings.length}`);
    }
    updated = updateOk;
    created = newMeetings.length;
  } else if (newMeetings.length) {
    console.log("\nSample new (dry-run):");
    for (const m of newMeetings.slice(0, 3))
      console.log(`  ${m.scheduled_at.slice(0,16)}  contact=${m.contact_id.slice(0,8)}  title="${m.title.slice(0,40)}"  recording=${m.recording_url ? "YES" : "no"}`);
  }
  void updated; void created;

  console.log("\n  Done.");
})().catch(e => { console.error(e); process.exit(1); });
