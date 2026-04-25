// Import Zoom webinar / meeting attendance into crm_events + crm_event_attendance_sessions.
//
// Reads Server-to-Server OAuth credentials from crm_integration_configs (provider='zoom').
// Matches participants to crm_contacts by email (case-insensitive).
// Per project rule: never auto-creates contacts. Unmatched attendees are recorded as sessions
// with registration_id = null and surfaced in the UI as "unmatched" attendees.
//
// Usage:
//   npm --prefix backend run build && tsx backend/scripts/import-zoom-attendance.ts [flags]
//
// Flags:
//   --auto                   Sync all completed webinars + meetings from the host in the last N days
//   --days=30                Look-back window for --auto (default 30)
//   --webinar-uuid=<uuid>    Sync one specific webinar occurrence by UUID
//   --meeting-uuid=<uuid>    Sync one specific meeting occurrence by UUID
//   --execute                Persist changes (otherwise DRY-RUN, no DB writes)

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

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const DRY_RUN = !argSet.has("--execute");
const argVal = (k: string) => {
  const a = argv.find(x => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : undefined;
};
const DAYS = parseInt(argVal("days") || "30", 10);
const ONE_WEBINAR = argVal("webinar-uuid");
const ONE_MEETING = argVal("meeting-uuid");
const AUTO = argSet.has("--auto");

interface ZoomConfig {
  account_id: string;
  client_id: string;
  client_secret: string;
  api_base?: string;
}
interface Participant {
  id: string;
  user_id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
  participant_user_id?: string;
}

// Encode a Zoom UUID for use in a path. Per Zoom docs: if it starts with '/' or contains '//',
// double-URL-encode; otherwise single-encode.
function encodeZoomUUID(u: string): string {
  const needsDouble = u.startsWith("/") || u.includes("//");
  return needsDouble ? encodeURIComponent(encodeURIComponent(u)) : encodeURIComponent(u);
}

async function getZoomToken(cfg: ZoomConfig): Promise<{ token: string; apiBase: string }> {
  const basic = Buffer.from(`${cfg.client_id}:${cfg.client_secret}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${cfg.account_id}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Zoom OAuth failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  return { token: data.access_token, apiBase: data.api_url || cfg.api_base || "https://api.zoom.us" };
}

async function zoomGET<T = any>(apiBase: string, token: string, path: string): Promise<T> {
  const res = await fetch(`${apiBase}/v2${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom GET ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function zoomGETAll<T = any>(apiBase: string, token: string, path: string, listKey: string): Promise<T[]> {
  const out: T[] = [];
  let nextPageToken = "";
  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${path}${sep}page_size=300${nextPageToken ? `&next_page_token=${nextPageToken}` : ""}`;
    const data: any = await zoomGET(apiBase, token, url);
    out.push(...(data[listKey] || []));
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);
  return out;
}

(async () => {
  console.log(`Zoom attendance → CRM`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "EXECUTE"}\n`);

  // 1. Load Zoom config
  const { data: cfg, error: cfgErr } = await sb
    .from("crm_integration_configs")
    .select("config")
    .eq("provider", "zoom")
    .eq("is_active", true)
    .maybeSingle();
  if (cfgErr) throw cfgErr;
  const zoomCfg: ZoomConfig | undefined = cfg?.config;
  if (!zoomCfg?.account_id || !zoomCfg?.client_id || !zoomCfg?.client_secret) {
    throw new Error("Zoom credentials missing in crm_integration_configs (provider='zoom')");
  }

  const { token, apiBase } = await getZoomToken(zoomCfg);
  console.log(`OAuth token acquired (api_base=${apiBase})`);

  // 2. Discover sessions from the recordings listing.
  // Zoom does not expose a /past_webinars/{uuid} endpoint, and /past_meetings/{uuid} requires
  // an extra scope we don't have. The recordings list response already includes everything
  // we need: uuid, id, topic, start_time, duration, type, host_id, share_url, recording_files,
  // and recording_play_passcode. So we use it as the single source of truth.
  type Target = {
    kind: "webinar" | "meeting";
    uuid: string;
    id: string;
    topic: string;
    startTime: string;
    durationMin: number;
    hostId: string | null;
    shareUrl: string | null;
    password: string | null;
    recordingFiles: any[];
  };

  const from = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  console.log(`Discovery: /users/me/recordings ${from} → ${to}`);
  const recs = await zoomGETAll<any>(apiBase, token, `/users/me/recordings?from=${from}&to=${to}`, "meetings");
  console.log(`Found ${recs.length} recorded sessions in window`);

  let allTargets: Target[] = recs.map(r => ({
    kind: r.type === 9 ? "webinar" : "meeting",
    uuid: r.uuid,
    id: String(r.id),
    topic: r.topic,
    startTime: r.start_time,
    durationMin: r.duration,
    hostId: r.host_id || null,
    shareUrl: r.share_url || null,
    password: r.recording_play_passcode || null,
    recordingFiles: r.recording_files || [],
  }));

  if (ONE_WEBINAR) allTargets = allTargets.filter(t => t.uuid === ONE_WEBINAR && t.kind === "webinar");
  if (ONE_MEETING) allTargets = allTargets.filter(t => t.uuid === ONE_MEETING && t.kind === "meeting");

  // De-duplicate by uuid
  const seen = new Set<string>();
  const uniqueTargets = allTargets.filter(t => (seen.has(t.uuid) ? false : (seen.add(t.uuid), true)));
  console.log(`Targets after filter: ${uniqueTargets.length}\n`);

  // Resolve host emails (cached by host_id)
  const hostEmailById = new Map<string, string>();
  for (const t of uniqueTargets) {
    if (t.hostId && !hostEmailById.has(t.hostId)) {
      try {
        const u: any = await zoomGET(apiBase, token, `/users/${t.hostId}`);
        if (u.email) hostEmailById.set(t.hostId, u.email);
      } catch { /* host fetch is best-effort */ }
    }
  }

  // 3. Process each target
  let synced = 0;
  let totalParticipants = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const t of uniqueTargets) {
    try {
      const enc = encodeZoomUUID(t.uuid);
      console.log(`\n=== ${t.kind} uuid=${t.uuid.slice(0, 24)}... id=${t.id} ===`);

      const startAt = t.startTime;
      const endMs = +new Date(startAt) + t.durationMin * 60_000;
      const endAt = new Date(endMs).toISOString();
      const eventTypeForCrm = t.kind === "webinar" ? "webinar" : "live_community";
      const hostEmail = t.hostId ? hostEmailById.get(t.hostId) || null : null;

      console.log(`  topic: ${(t.topic || "").slice(0, 60)}`);
      console.log(`  start: ${startAt}  duration: ${t.durationMin}m  host: ${hostEmail || "?"}`);
      console.log(`  recording files: ${t.recordingFiles.length}${t.shareUrl ? " (has share_url)" : ""}`);

      // 3a. Upsert crm_events (idempotent via external_source + external_id = uuid)
      const eventRow = {
        event_type: eventTypeForCrm,
        title: t.topic || (t.kind === "webinar" ? "וובינר" : "לייב"),
        scheduled_at: startAt,
        end_at: endAt,
        duration_minutes: t.durationMin,
        meeting_url: null as string | null,
        recording_url: t.shareUrl,
        recording_files: t.recordingFiles.length ? t.recordingFiles : null,
        recording_password: t.password,
        host_email: hostEmail,
        status: "completed",
        external_source: "zoom",
        external_id: t.uuid,
        external_metadata: {
          zoom_uuid: t.uuid,
          zoom_id: t.id,
          host_id: t.hostId,
          type: t.kind === "webinar" ? 9 : 8,
        },
        last_synced_at: new Date().toISOString(),
      };

      let eventId: string | null = null;
      if (!DRY_RUN) {
        const { data, error } = await sb
          .from("crm_events")
          .upsert(eventRow, { onConflict: "external_source,external_id" })
          .select("id")
          .single();
        if (error) { console.log(`  ! event upsert failed: ${error.message}`); continue; }
        eventId = data.id;
      } else {
        // In dry-run, look up if event already exists for reporting
        const { data } = await sb.from("crm_events").select("id").eq("external_source", "zoom").eq("external_id", t.uuid).maybeSingle();
        eventId = data?.id || null;
      }

      // 3d. Fetch participants report (paginated)
      const partsPath = t.kind === "webinar"
        ? `/report/webinars/${enc}/participants`
        : `/report/meetings/${enc}/participants`;
      const participants: Participant[] = await zoomGETAll<Participant>(apiBase, token, partsPath, "participants");
      console.log(`  participants: ${participants.length}`);
      totalParticipants += participants.length;

      // 3e. Match to contacts and write sessions
      const emails = Array.from(new Set(participants.map(p => (p.user_email || "").trim().toLowerCase()).filter(Boolean)));
      let contactsByEmail = new Map<string, string>();
      if (emails.length) {
        const { data: contacts } = await sb
          .from("crm_contacts")
          .select("id,email")
          .in("email", emails);
        contactsByEmail = new Map((contacts || []).map((c: any) => [c.email.toLowerCase(), c.id]));
      }

      const sessionRows: any[] = [];
      const earliestJoinByContact = new Map<string, string>();
      const matchedContactIds = new Set<string>();
      let unmatchedCount = 0;

      for (const p of participants) {
        const email = (p.user_email || "").trim().toLowerCase();
        const contactId = email ? contactsByEmail.get(email) : undefined;

        if (contactId) {
          matchedContactIds.add(contactId);
          const prev = earliestJoinByContact.get(contactId);
          if (!prev || p.join_time < prev) earliestJoinByContact.set(contactId, p.join_time);
        } else {
          unmatchedCount++;
        }

        sessionRows.push({
          event_id: eventId,
          // registration_id is filled in the second pass (after registrations are upserted)
          _temp_contact_id: contactId || null,
          participant_email: p.user_email || null,
          participant_name: p.name || null,
          participant_external_id: p.participant_user_id || p.user_id || null,
          joined_at: p.join_time,
          left_at: p.leave_time,
          duration_seconds: p.duration || 0,
          external_source: "zoom",
          raw: p,
        });
      }

      totalMatched += matchedContactIds.size;
      totalUnmatched += unmatchedCount;
      console.log(`  matched: ${matchedContactIds.size} contacts  unmatched: ${unmatchedCount}`);

      if (DRY_RUN) {
        console.log(`  [dry-run] would upsert event + ${matchedContactIds.size} registrations + ${sessionRows.length} sessions`);
        synced++;
        continue;
      }
      if (!eventId) { console.log(`  ! no event id (event upsert silently skipped?)`); continue; }

      // 3f. Upsert registrations for matched contacts (attended=true)
      const regRows = Array.from(matchedContactIds).map(cid => ({
        event_id: eventId,
        contact_id: cid,
        registered: true,
        attended: true,
        attended_at: earliestJoinByContact.get(cid),
        external_source: "zoom",
      }));

      const regIdByContact = new Map<string, string>();
      if (regRows.length) {
        const { data: regData, error: regErr } = await sb
          .from("crm_event_registrations")
          .upsert(regRows, { onConflict: "event_id,contact_id" })
          .select("id,contact_id");
        if (regErr) { console.log(`  ! registration upsert failed: ${regErr.message}`); }
        else for (const r of regData || []) regIdByContact.set((r as any).contact_id, (r as any).id);
      }

      // 3g. Insert sessions (with registration_id resolved)
      // Idempotent via UNIQUE INDEX (event_id, participant_external_id, joined_at)
      const finalSessions = sessionRows.map(s => ({
        event_id: s.event_id,
        registration_id: s._temp_contact_id ? (regIdByContact.get(s._temp_contact_id) || null) : null,
        participant_email: s.participant_email,
        participant_name: s.participant_name,
        participant_external_id: s.participant_external_id,
        joined_at: s.joined_at,
        left_at: s.left_at,
        duration_seconds: s.duration_seconds,
        external_source: s.external_source,
        raw: s.raw,
      }));

      // Delete-then-insert: re-running the sync replaces all sessions for this event.
      // (The partial unique index can't be used with PostgREST's onConflict.)
      const { error: delErr } = await sb
        .from("crm_event_attendance_sessions")
        .delete()
        .eq("event_id", eventId);
      if (delErr) console.log(`  ! sessions delete failed: ${delErr.message}`);
      if (finalSessions.length) {
        const { error: insErr } = await sb
          .from("crm_event_attendance_sessions")
          .insert(finalSessions);
        if (insErr) console.log(`  ! sessions insert failed: ${insErr.message}`);
      }

      // 3h. Update aggregate counts on crm_events
      const { error: updErr } = await sb
        .from("crm_events")
        .update({
          attended_count: matchedContactIds.size + unmatchedCount,
        })
        .eq("id", eventId);
      if (updErr) console.log(`  ! event count update failed: ${updErr.message}`);

      synced++;
    } catch (err: any) {
      console.log(`  ! error: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Sessions processed: ${synced}/${uniqueTargets.length}`);
  console.log(`Total participants: ${totalParticipants}`);
  console.log(`Matched contacts:   ${totalMatched}`);
  console.log(`Unmatched:          ${totalUnmatched}`);
  if (DRY_RUN) console.log(`\nDRY-RUN — no changes written. Add --execute to persist.`);
})().catch(e => { console.error(e); process.exit(1); });
