import {
  mapLeadStatus,
  mapContactStage,
  mapSource,
  mapAdPlatform,
  mapEntryType,
} from "./fireberry-mappings";

// ===== Normalization helpers =====
function normalizePhone(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Israeli: ensure leading 0 for local numbers
  if (digits.startsWith("972")) return "0" + digits.slice(3);
  return digits;
}

function normalizeEmail(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeDate(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function splitName(fullName: string | null | undefined, first?: string, last?: string): [string, string] {
  if (first || last) return [(first || "").trim(), (last || "").trim()];
  if (!fullName) return ["", ""];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

// ===== Target types (subset of crm_contacts / crm_events / crm_event_registrations) =====
export interface ContactInsert {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  company: string | null;
  address: string | null;
  id_number: string | null;
  status: string;
  source: string;
  stage_id: string | null;
  tags: string[];
  notes: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  entry_type: string | null;
  ad_platform: string | null;
  first_touch_at: string | null;
  conversion_at: string | null;
  loss_reason: string | null;
  assigned_to: string | null;
  created_at: string | null;
  custom_fields: Record<string, any>;
}

export interface EventInsert {
  event_type: "webinar" | "live_community" | "workshop";
  title: string;
  description: string | null;
  scheduled_at: string;
  end_at: string | null;
  duration_minutes: number;
  meeting_url: string | null;
  recording_url: string | null;
  registration_url: string | null;
  status: "upcoming" | "live" | "completed" | "cancelled";
  registered_count: number;
  attended_count: number;
  leads_generated: number;
  deals_count: number;
  revenue: number;
  cohort: string | null;
  notes: string | null;
  external_source: string;
  external_id: string;
  created_at: string | null;
}

export interface EventRegistrationInsert {
  event_id: string;
  contact_id: string;
  registered: boolean;
  attended: boolean;
  registered_at: string | null;
  attended_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  click_id: string | null;
  ad_name: string | null;
  external_source: string;
  external_id: string;
}

// ===== Fireberry record types =====
export type FbWebinar = Record<string, any>;
export type FbContact = Record<string, any>;
export type FbLead = Record<string, any>;

export interface TeamMemberLookup {
  [displayName: string]: string; // name → team_member_id
}

// ===== Transform: Fireberry webinar → crm_events =====
export function transformWebinar(w: FbWebinar): EventInsert | null {
  const scheduledAt = normalizeDate(w.pcfsystemfield197);
  if (!scheduledAt) return null;

  const endAt = normalizeDate(w.pcfsystemfield198);
  const start = new Date(scheduledAt);
  const end = endAt ? new Date(endAt) : null;
  const durationMin = end ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) : 60;

  const now = Date.now();
  const status = start.getTime() > now
    ? "upcoming"
    : end && end.getTime() < now
    ? "completed"
    : "completed";

  return {
    event_type: "webinar",
    title: w.name || "וובינר ללא שם",
    description: null,
    scheduled_at: scheduledAt,
    end_at: endAt,
    duration_minutes: durationMin,
    meeting_url: w.pcfsystemfield202 || null,
    recording_url: w.pcfsystemfield203 || null,
    registration_url: w.pcfsystemfield204 || null,
    status,
    registered_count: Number(w.pcfsystemfield195) || 0,
    attended_count: Number(w.pcfsystemfield196) || 0,
    leads_generated: Number(w.pcfsystemfield199) || 0,
    deals_count: Number(w.pcfsystemfield200) || 0,
    revenue: Number(w.pcfsystemfield201) || 0,
    cohort: w.pcfsystemfield61name || null,
    notes: null,
    external_source: "fireberry",
    external_id: w.customobject1001id,
    created_at: normalizeDate(w.createdon),
  };
}

// ===== Transform: Fireberry contact (webinar registrant) → crm_contacts =====
// allowMissingContact=true: include rows without email AND phone (tagged as needs_contact_info)
export function transformRegistrant(
  c: FbContact,
  teamMembers: TeamMemberLookup,
  allowMissingContact = false,
): ContactInsert | null {
  const email = normalizeEmail(c.emailaddress1);
  const phone = normalizePhone(c.telephone1) || normalizePhone(c.mobilephone1);
  if (!email && !phone && !allowMissingContact) return null;

  const [firstName, lastName] = splitName(c.fullname, c.firstname, c.lastname);
  if (!firstName && !lastName) return null;
  const extraTag = !email && !phone ? ["needs_contact_info"] : [];

  const statusInfo = mapContactStage(c.pcfsystemfield51name);
  const source = mapSource(c.pcfsystemfield101name);
  const adPlatform = mapAdPlatform(c.pcfsystemfield100name);

  return {
    first_name: firstName || "ללא שם",
    last_name: lastName || "",
    email,
    phone,
    whatsapp_phone: phone,
    company: c.companyname || null,
    address: [c.billingstreet, c.billingcity, c.billingstate].filter(Boolean).join(", ") || null,
    id_number: null,
    status: statusInfo.status,
    source,
    stage_id: statusInfo.stageId,
    tags: ["fireberry", "webinar_registrant", ...extraTag],
    notes: c.description || null,
    marketing_consent: c.isvalidforemailcode === 1 || c.isvalidforemailcode === "1" || c.isvalidforemailcode === "כן",
    marketing_consent_at: normalizeDate(c.createdon),
    utm_source: c.pcfsystemfield102 || null,
    utm_medium: c.pcfsystemfield104 || null,
    utm_campaign: c.pcfsystemfield103 || null,
    utm_content: c.pcfsystemfield105 || null,
    utm_term: c.pcfsystemfield106 || null,
    entry_type: "webinar",
    ad_platform: adPlatform,
    first_touch_at: normalizeDate(c.createdon),
    conversion_at: null,
    loss_reason: null,
    assigned_to: teamMembers[c.ownername] || null,
    created_at: normalizeDate(c.createdon),
    custom_fields: {
      fireberry_contact_id: c.contactid,
      fireberry_status_raw: c.pcfsystemfield51name,
      fireberry_source_raw: c.pcfsystemfield101name,
      fireberry_exposure_raw: c.pcfsystemfield100name,
      rav_messer_id: c.pcfravmesserid || null,
      click_id: c.pcfsystemfield111 || null,
      ad_name: c.pcfsystemfield110name || null,
      webinar_registered: c.pcfsystemfield108name || null,
      webinar_attended: c.pcfsystemfield109name || null,
      fireberry_created_on: c.createdon,
    },
  };
}

// ===== Transform: Fireberry lead → crm_contacts =====
export function transformLead(
  l: FbLead,
  teamMembers: TeamMemberLookup,
  hasWebinarMatch: boolean,
  allowMissingContact = false,
): ContactInsert | null {
  const email = normalizeEmail(l.pcfsystemfield102);
  const phone = normalizePhone(l.pcfsystemfield101);
  if (!email && !phone && !allowMissingContact) return null;

  const [firstName, lastName] = splitName(l.name);
  if (!firstName) return null;
  const extraTag = !email && !phone ? ["needs_contact_info"] : [];

  const usedPipeline = hasWebinarMatch ? "webinar" : "vsl";
  const statusInfo = mapLeadStatus(l.statuscode, l.status, usedPipeline);
  const source = mapSource(l.pcfsystemfield105name);
  const adPlatform = mapAdPlatform(l.pcfsystemfield104name);

  return {
    first_name: firstName,
    last_name: lastName || "",
    email,
    phone,
    whatsapp_phone: phone,
    company: null,
    address: l.pcfsystemfield118 || null,
    id_number: l.pcfsystemfield117 || null,
    status: statusInfo.status,
    source,
    stage_id: statusInfo.stageId,
    tags: ["fireberry", "lead", ...(hasWebinarMatch ? ["matched_webinar"] : ["vsl"]), ...extraTag],
    notes: l.description || null,
    marketing_consent: l.pcfsystemfield120 === 1 || l.pcfsystemfield120 === "1" || l.pcfsystemfield120name === "כן",
    marketing_consent_at: normalizeDate(l.createdon),
    utm_source: l.pcfsystemfield108 || null,
    utm_medium: l.pcfsystemfield109 || null,
    utm_campaign: l.pcfsystemfield110 || null,
    utm_content: l.pcfsystemfield112 || null,
    utm_term: l.pcfsystemfield111 || null,
    entry_type: mapEntryType(l.pcfsystemfield105name, hasWebinarMatch),
    ad_platform: adPlatform,
    first_touch_at: normalizeDate(l.createdon),
    conversion_at: l.statuscode === "נסגר" ? normalizeDate(l.modifiedon) : null,
    loss_reason: l.pcfsystemfield115name || null,
    assigned_to: teamMembers[l.ownername] || null,
    created_at: normalizeDate(l.createdon),
    custom_fields: {
      fireberry_opportunity_id: l.opportunityid,
      fireberry_statuscode: l.statuscode,
      fireberry_status_text: l.status,
      fireberry_source_raw: l.pcfsystemfield105name,
      fireberry_exposure_raw: l.pcfsystemfield104name,
      meeting_status: l.pcfsystemfield103name || null,
      meeting_date: normalizeDate(l.pcfsystemfield125),
      meeting_link: l.pcfsystemfield126 || null,
      meeting_summary: l.pcfsystemfield123 || null,
      end_to_end_meeting: l.pcfsystemfield131 || null,
      followup_date: normalizeDate(l.pcfsystemfield132),
      track: l.pcfsystemfield116name || null,
      cohort: l.pcfsystemfield135name || null,
      referring_student: l.pcfsystemfield127name || null,
      referring_student2: l.pcfsystemfield134name || null,
      ref_code: l.pcfsystemfield130 || null,
      rav_messer_id: l.pcfsystemfield114 || null,
      click_id: l.pcfsystemfield121 || null,
      ad_name: l.pcfsystemfield107name || null,
      filled_questionnaire: l.pcfsystemfield133 || null,
      community_added: l.pcfsystemfield124 || null,
      linked_webinar: l.pcfsystemfield100name || null,
      estimated_value: Number(l.estimatedvalue) || 0,
      fireberry_created_on: l.createdon,
      fireberry_modified_on: l.modifiedon,
    },
  };
}

// ===== Merge lead data into an existing contact (same email/phone as webinar registrant) =====
export function mergeLeadIntoContact(
  existing: ContactInsert,
  lead: ContactInsert,
): ContactInsert {
  return {
    ...existing,
    // Lead wins on sales/pipeline state
    status: lead.status,
    stage_id: lead.stage_id,
    loss_reason: lead.loss_reason ?? existing.loss_reason,
    conversion_at: lead.conversion_at ?? existing.conversion_at,
    entry_type: lead.entry_type ?? existing.entry_type,
    assigned_to: lead.assigned_to ?? existing.assigned_to,
    id_number: lead.id_number ?? existing.id_number,
    address: lead.address ?? existing.address,
    notes: [existing.notes, lead.notes].filter(Boolean).join("\n---\n") || null,
    tags: Array.from(new Set([...existing.tags, ...lead.tags])),
    custom_fields: { ...existing.custom_fields, ...lead.custom_fields, merged: true },
  };
}

// ===== Build registration row from a lead (uses pcfsystemfield100 = linked webinar) =====
export function buildLeadRegistration(
  l: FbLead,
  contactId: string,
  webinarIdByExternal: Record<string, string>,
): EventRegistrationInsert | null {
  const webId = l.pcfsystemfield100;
  if (!webId) return null;
  const eventId = webinarIdByExternal[webId];
  if (!eventId) return null;

  // Infer attended: if lead progressed past "ליד חדש", they likely attended
  const advancedStatuses = new Set(["פולואפ", "נסגר", "לא נסגר", "לא רלוונטי"]);
  const attended = advancedStatuses.has(l.status || "");

  return {
    event_id: eventId,
    contact_id: contactId,
    registered: true,
    attended,
    registered_at: normalizeDate(l.createdon),
    attended_at: attended ? normalizeDate(l.modifiedon) : null,
    utm_source: l.pcfsystemfield108 || null,
    utm_medium: l.pcfsystemfield109 || null,
    utm_campaign: l.pcfsystemfield110 || null,
    utm_content: l.pcfsystemfield112 || null,
    utm_term: l.pcfsystemfield111 || null,
    click_id: l.pcfsystemfield121 || null,
    ad_name: l.pcfsystemfield107name || null,
    external_source: "fireberry",
    external_id: l.opportunityid,
  };
}

// ===== Build registration rows linking contacts to webinars =====
export function buildRegistrations(
  c: FbContact,
  contactId: string,
  webinarIdByExternal: Record<string, string>,
): EventRegistrationInsert[] {
  const rows: EventRegistrationInsert[] = [];
  const registeredId = c.pcfsystemfield108;
  const attendedId = c.pcfsystemfield109;
  const registeredWebinarId = registeredId && webinarIdByExternal[registeredId];
  const attendedWebinarId = attendedId && webinarIdByExternal[attendedId];

  if (registeredWebinarId) {
    rows.push({
      event_id: registeredWebinarId,
      contact_id: contactId,
      registered: true,
      attended: attendedWebinarId === registeredWebinarId,
      registered_at: normalizeDate(c.createdon),
      attended_at: attendedWebinarId === registeredWebinarId ? normalizeDate(c.modifiedon) : null,
      utm_source: c.pcfsystemfield102 || null,
      utm_medium: c.pcfsystemfield104 || null,
      utm_campaign: c.pcfsystemfield103 || null,
      utm_content: c.pcfsystemfield105 || null,
      utm_term: c.pcfsystemfield106 || null,
      click_id: c.pcfsystemfield111 || null,
      ad_name: c.pcfsystemfield110name || null,
      external_source: "fireberry",
      external_id: c.contactid,
    });
  }
  // If attended a different webinar than registered (unusual), record separately
  if (attendedWebinarId && attendedWebinarId !== registeredWebinarId) {
    rows.push({
      event_id: attendedWebinarId,
      contact_id: contactId,
      registered: false,
      attended: true,
      registered_at: null,
      attended_at: normalizeDate(c.modifiedon),
      utm_source: c.pcfsystemfield102 || null,
      utm_medium: c.pcfsystemfield104 || null,
      utm_campaign: c.pcfsystemfield103 || null,
      utm_content: c.pcfsystemfield105 || null,
      utm_term: c.pcfsystemfield106 || null,
      click_id: c.pcfsystemfield111 || null,
      ad_name: c.pcfsystemfield110name || null,
      external_source: "fireberry",
      external_id: c.contactid,
    });
  }

  return rows;
}
