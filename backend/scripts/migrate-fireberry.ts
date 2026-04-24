import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FireberryClient } from "./fireberry-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { FB_OBJECT } from "./fireberry-mappings";
import {
  transformWebinar,
  transformRegistrant,
  transformLead,
  mergeLeadIntoContact,
  buildRegistrations,
  ContactInsert,
  EventInsert,
  EventRegistrationInsert,
  TeamMemberLookup,
} from "./fireberry-transform";

// Minimal env loader — reads KEY=VALUE from .env files without external deps.
function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(join(__dirname, "..", ".env"));
loadEnvFile(join(__dirname, "..", "..", ".env"));

const FIREBERRY_TOKEN = process.env.FIREBERRY_TOKEN_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!FIREBERRY_TOKEN) throw new Error("FIREBERRY_TOKEN_ID missing in env");
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in env");

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");
const STAGE = [...args].find(a => a.startsWith("--stage="))?.split("=")[1] || "all";

const fb = new FireberryClient(FIREBERRY_TOKEN);
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const TMP_DIR = join(__dirname, "..", "..", "tmp", "fireberry");
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// ===== Helpers =====
function log(...args: any[]) { console.log(...args); }

// Fireberry ownername → CRM display_name aliases (spelling differences)
const OWNER_ALIASES: Record<string, string> = {
  "ניצן טהר לב": "ניצן טהר-לב",
};

async function fetchTeamMembers(): Promise<TeamMemberLookup> {
  const { data, error } = await sb.from("crm_team_members").select("id, display_name");
  if (error) throw new Error(`Fetch team members failed: ${error.message}`);
  const map: TeamMemberLookup = {};
  for (const m of data || []) if (m.display_name) map[m.display_name] = m.id;
  // Add reverse aliases so Fireberry names resolve to CRM ids
  for (const [fbName, crmName] of Object.entries(OWNER_ALIASES)) {
    if (map[crmName]) map[fbName] = map[crmName];
  }
  return map;
}

async function chunkedUpsert<T>(
  table: string,
  rows: T[],
  onConflict: string,
  chunkSize = 100,
): Promise<{ inserted: number; errors: Array<{ chunk: number; error: string }> }> {
  let inserted = 0;
  const errors: Array<{ chunk: number; error: string }> = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).upsert(chunk as any, { onConflict, ignoreDuplicates: false });
    if (error) {
      errors.push({ chunk: i / chunkSize, error: error.message });
      log(`  ! chunk ${i / chunkSize} (${table}): ${error.message}`);
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, errors };
}

async function chunkedInsert<T>(
  table: string,
  rows: T[],
  chunkSize = 100,
): Promise<{ inserted: number; errors: Array<{ chunk: number; error: string }> }> {
  let inserted = 0;
  const errors: Array<{ chunk: number; error: string }> = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).insert(chunk as any);
    if (error) {
      errors.push({ chunk: i / chunkSize, error: error.message });
      log(`  ! chunk ${i / chunkSize} (${table}): ${error.message}`);
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, errors };
}

async function fetchExistingContactKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await sb
      .from("crm_contacts")
      .select("email, phone")
      .range(from, from + page - 1);
    if (error) throw new Error(`Fetch existing contacts failed: ${error.message}`);
    if (!data || !data.length) break;
    for (const r of data) {
      if (r.email) keys.add(r.email.toLowerCase());
      if (r.phone) keys.add(r.phone);
    }
    if (data.length < page) break;
    from += page;
  }
  return keys;
}

// ===== Stages =====

async function stageWebinars(): Promise<{
  webinarIdByExternal: Record<string, string>;
  preview: Array<EventInsert & { __fireberry: any }>;
}> {
  log("\n== STAGE 1: Webinars ==");
  const raw = await fb.queryAll<any>(FB_OBJECT.WEBINAR, "*");
  log(`  fetched ${raw.length} webinars from Fireberry`);

  const rows: EventInsert[] = [];
  const preview: Array<EventInsert & { __fireberry: any }> = [];
  const skipped: any[] = [];
  for (const w of raw) {
    const t = transformWebinar(w);
    if (!t) { skipped.push({ reason: "no scheduled_at", customobject1001id: w.customobject1001id, name: w.name }); continue; }
    rows.push(t);
    preview.push({ ...t, __fireberry: { id: w.customobject1001id, name: w.name } });
  }
  log(`  transformed: ${rows.length}, skipped: ${skipped.length}`);

  const webinarIdByExternal: Record<string, string> = {};

  if (!DRY_RUN && rows.length) {
    const { inserted, errors } = await chunkedUpsert("crm_events", rows, "external_source,external_id");
    log(`  upserted: ${inserted}, chunks with errors: ${errors.length}`);
    const { data, error } = await sb.from("crm_events").select("id, external_id").eq("external_source", "fireberry");
    if (error) throw error;
    for (const r of data || []) if (r.external_id) webinarIdByExternal[r.external_id] = r.id;
    log(`  mapped ${Object.keys(webinarIdByExternal).length} external→internal ids`);
  } else {
    // In dry-run we mint fake IDs so downstream preview can reference them
    for (const w of raw) if (w.customobject1001id) webinarIdByExternal[w.customobject1001id] = `DRYRUN-${w.customobject1001id}`;
  }

  writeFileSync(join(TMP_DIR, "preview_webinars.json"), JSON.stringify({ count: rows.length, skipped, rows: preview }, null, 2));
  return { webinarIdByExternal, preview };
}

async function stageContacts(
  teamMembers: TeamMemberLookup,
  webinarIdByExternal: Record<string, string>,
): Promise<{
  contactsByKey: Map<string, ContactInsert & { __fb_contact_id: string }>;
  previewCount: { total: number; transformed: number; skipped: number };
  registrations: EventRegistrationInsert[];
}> {
  log("\n== STAGE 2: Webinar registrants (Contact) ==");
  const raw = await fb.queryAll<any>(FB_OBJECT.CONTACT, "*");
  log(`  fetched ${raw.length} registrants from Fireberry`);

  const contactsByKey = new Map<string, ContactInsert & { __fb_contact_id: string }>();
  const skipped: Array<{ reason: string; contactid?: string }> = [];
  let transformed = 0;

  for (const c of raw) {
    const t = transformRegistrant(c, teamMembers);
    if (!t) { skipped.push({ reason: "no contact info or name", contactid: c.contactid }); continue; }
    transformed++;
    const key = (t.email || t.phone)!.toLowerCase();
    // internal dedupe: keep latest (by modifiedon)
    const prev = contactsByKey.get(key);
    if (prev) {
      const prevTs = prev.custom_fields.fireberry_modified_on || prev.custom_fields.fireberry_created_on;
      const curTs = c.modifiedon || c.createdon;
      if (curTs && (!prevTs || curTs > prevTs)) {
        contactsByKey.set(key, { ...t, __fb_contact_id: c.contactid });
      }
    } else {
      contactsByKey.set(key, { ...t, __fb_contact_id: c.contactid });
    }
  }
  log(`  transformed: ${transformed}, skipped: ${skipped.length}, deduped: ${contactsByKey.size}`);

  const contactEntries = [...contactsByKey.entries()];
  let contactIdByKey: Map<string, string> = new Map();
  let skippedExisting = 0;

  if (!DRY_RUN && contactEntries.length) {
    // Filter out contacts whose email/phone already exist in DB (avoids manual duplicates)
    const existingKeys = await fetchExistingContactKeys();
    log(`  existing contacts in DB: ${existingKeys.size} unique email/phone keys`);

    const toInsert: Array<Omit<typeof contactEntries[0][1], "__fb_contact_id">> = [];
    const skippedKeys: string[] = [];
    for (const [, c] of contactEntries) {
      const existsEmail = c.email && existingKeys.has(c.email.toLowerCase());
      const existsPhone = c.phone && existingKeys.has(c.phone);
      if (existsEmail || existsPhone) {
        skippedKeys.push((c.email || c.phone)!);
        skippedExisting++;
        continue;
      }
      const { __fb_contact_id, ...row } = c;
      toInsert.push(row);
    }
    log(`  skipped (already in DB): ${skippedExisting}, inserting: ${toInsert.length}`);

    const { inserted, errors } = await chunkedInsert("crm_contacts", toInsert, 200);
    log(`  inserted: ${inserted}, chunks with errors: ${errors.length}`);

    // Re-fetch all contacts to build id map for registration linking
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from("crm_contacts")
        .select("id, email, phone")
        .range(from, from + 999);
      if (error) throw error;
      if (!data || !data.length) break;
      for (const r of data) {
        if (r.email) contactIdByKey.set(r.email.toLowerCase(), r.id);
        if (r.phone) contactIdByKey.set(r.phone, r.id);
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    log(`  contact id map built: ${contactIdByKey.size} keys`);
  } else {
    for (const [key, c] of contactsByKey) contactIdByKey.set(key, `DRYRUN-${c.__fb_contact_id}`);
  }

  // Build registrations
  const registrations: EventRegistrationInsert[] = [];
  for (const c of raw) {
    const t = transformRegistrant(c, teamMembers);
    if (!t) continue;
    const key = (t.email || t.phone)!.toLowerCase();
    const contactId = contactIdByKey.get(key);
    if (!contactId) continue;
    registrations.push(...buildRegistrations(c, contactId, webinarIdByExternal));
  }
  log(`  built ${registrations.length} event registrations`);

  // Dedupe registrations by (event_id, contact_id) — multiple Fireberry rows may point to same pair
  const regSeen = new Set<string>();
  const regDeduped: typeof registrations = [];
  for (const r of registrations) {
    const k = `${r.event_id}|${r.contact_id}`;
    if (regSeen.has(k)) continue;
    regSeen.add(k);
    regDeduped.push(r);
  }
  log(`  registrations after dedupe: ${regDeduped.length} (was ${registrations.length})`);

  if (!DRY_RUN && regDeduped.length) {
    const { inserted, errors } = await chunkedUpsert("crm_event_registrations", regDeduped, "event_id,contact_id");
    log(`  event_registrations inserted: ${inserted}, errors: ${errors.length}`);
  }

  writeFileSync(
    join(TMP_DIR, "preview_contacts.json"),
    JSON.stringify({
      total: raw.length,
      transformed,
      skipped,
      deduped_count: contactsByKey.size,
      sample_first_5: contactEntries.slice(0, 5).map(([, c]) => { const { __fb_contact_id, ...r } = c; return r; }),
      registrations_count: registrations.length,
    }, null, 2),
  );

  return {
    contactsByKey,
    previewCount: { total: raw.length, transformed, skipped: skipped.length },
    registrations,
  };
}

async function stageLeads(
  teamMembers: TeamMemberLookup,
  contactsByKey: Map<string, ContactInsert & { __fb_contact_id: string }>,
): Promise<void> {
  log("\n== STAGE 3: Leads (Opportunity) ==");
  const raw = await fb.queryAll<any>(FB_OBJECT.OPPORTUNITY, "*");
  log(`  fetched ${raw.length} leads from Fireberry`);

  const newContacts: ContactInsert[] = [];
  const mergedContacts: Array<{ key: string; merged: ContactInsert }> = [];
  const skipped: Array<{ reason: string; opportunityid?: string }> = [];
  let transformed = 0;

  for (const l of raw) {
    const email = (typeof l.pcfsystemfield102 === "string" ? l.pcfsystemfield102.trim().toLowerCase() : "");
    const phone = typeof l.pcfsystemfield101 === "string" ? l.pcfsystemfield101.replace(/\D/g, "") : "";
    const normalizedPhone = phone.startsWith("972") ? "0" + phone.slice(3) : phone;
    const emailKey = email || null;
    const phoneKey = normalizedPhone || null;

    const matchedKey =
      (emailKey && contactsByKey.has(emailKey)) ? emailKey :
      (phoneKey && contactsByKey.has(phoneKey)) ? phoneKey :
      null;

    const hasWebinarMatch = !!matchedKey;
    const t = transformLead(l, teamMembers, hasWebinarMatch);
    if (!t) { skipped.push({ reason: "no contact info or name", opportunityid: l.opportunityid }); continue; }
    transformed++;

    if (matchedKey) {
      const existing = contactsByKey.get(matchedKey)!;
      const merged = mergeLeadIntoContact(existing, t);
      mergedContacts.push({ key: matchedKey, merged });
    } else {
      newContacts.push(t);
    }
  }
  log(`  transformed: ${transformed}, new: ${newContacts.length}, merged_with_registrant: ${mergedContacts.length}, skipped: ${skipped.length}`);

  if (!DRY_RUN) {
    if (newContacts.length) {
      const existingKeys = await fetchExistingContactKeys();
      const toInsert = newContacts.filter(c => {
        const existsEmail = c.email && existingKeys.has(c.email.toLowerCase());
        const existsPhone = c.phone && existingKeys.has(c.phone);
        return !existsEmail && !existsPhone;
      });
      log(`  new leads: ${newContacts.length}, skipped (already in DB): ${newContacts.length - toInsert.length}, inserting: ${toInsert.length}`);
      const { inserted, errors } = await chunkedInsert("crm_contacts", toInsert, 200);
      log(`  new leads inserted: ${inserted}, chunks with errors: ${errors.length}`);
    }
    // Update merged records (matched an existing registrant by email/phone)
    let updated = 0;
    for (const { merged } of mergedContacts) {
      const filter = merged.email
        ? `email.eq.${merged.email}`
        : merged.phone ? `phone.eq.${merged.phone}` : null;
      if (!filter) continue;
      const { error } = await sb
        .from("crm_contacts")
        .update({
          status: merged.status,
          stage_id: merged.stage_id,
          loss_reason: merged.loss_reason,
          conversion_at: merged.conversion_at,
          entry_type: merged.entry_type,
          assigned_to: merged.assigned_to,
          id_number: merged.id_number,
          address: merged.address,
          notes: merged.notes,
          tags: merged.tags,
          custom_fields: merged.custom_fields,
        })
        .or(filter);
      if (!error) updated++;
    }
    log(`  merged contacts updated: ${updated}/${mergedContacts.length}`);
  }

  writeFileSync(
    join(TMP_DIR, "preview_leads.json"),
    JSON.stringify({
      total: raw.length,
      transformed,
      new: newContacts.length,
      merged: mergedContacts.length,
      skipped,
      sample_new_first_5: newContacts.slice(0, 5),
      sample_merged_first_3: mergedContacts.slice(0, 3),
    }, null, 2),
  );
}

// ===== Main =====

(async () => {
  log(`\n  Fireberry → CRM migration`);
  log(`  Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "EXECUTE (writes to DB)"}`);
  log(`  Stage: ${STAGE}\n`);

  const teamMembers = await fetchTeamMembers();
  log(`Team members in CRM: ${Object.keys(teamMembers).length}`);

  let webinarIdByExternal: Record<string, string> = {};
  let contactsByKey = new Map<string, ContactInsert & { __fb_contact_id: string }>();

  if (STAGE === "all" || STAGE === "webinars") {
    ({ webinarIdByExternal } = await stageWebinars());
  }
  if (STAGE === "all" || STAGE === "contacts") {
    if (STAGE === "contacts" && !Object.keys(webinarIdByExternal).length) {
      // need webinar id map even if we skipped the stage
      const { data } = await sb.from("crm_events").select("id, external_id").eq("external_source", "fireberry");
      for (const r of data || []) if (r.external_id) webinarIdByExternal[r.external_id] = r.id;
    }
    ({ contactsByKey } = await stageContacts(teamMembers, webinarIdByExternal));
  }
  if (STAGE === "all" || STAGE === "leads") {
    await stageLeads(teamMembers, contactsByKey);
  }

  log("\n  Done.");
  log(`  Preview files written to: ${TMP_DIR}`);
})().catch(err => {
  console.error("MIGRATION FAILED:", err);
  process.exit(1);
});
