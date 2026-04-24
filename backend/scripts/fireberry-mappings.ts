// Fireberry → CRM field mappings.

// ===== Object types =====
export const FB_OBJECT = {
  OPPORTUNITY: 4, // "ליד" (lead)
  CONTACT: 2,     // "נרשם לוובינר" (webinar registrant)
  WEBINAR: 1001,  // "וובינר"
} as const;

// ===== Pipeline / stage UUIDs (from DB) =====
export const PIPELINE = {
  WEBINAR: "a1c30226-ff7d-4652-bed9-811bf1162286",
  VSL: "952f95dd-0898-45c3-a728-567d1f89b879",
} as const;

// Webinar pipeline stages
export const WEBINAR_STAGE = {
  NEW: "37ad0422-37ac-40f9-9a21-ed0e34dd1003",           // חדש
  ATTENDED_WEBINAR: "5735fdd6-f34d-417d-af46-46f3b9f8f36e", // נכח בוובינר
  ATTENDED_PITCH: "fc7016cd-b611-46dc-9982-9ab917c5c8e6",   // נכח בשלב ההצעה
  BOOKED_MEETING: "982dedf5-dc26-4991-bd17-65909fd57745",   // קבע פגישה
  INITIAL_CONTACT: "f3d79cbc-6c69-4b06-8125-d861a0f6e5c2", // נוצר קשר ראשוני
  FOLLOWUP: "a0203e0a-c151-4957-8369-ffa9227c9527",        // פולואפ
  WON: "5072ec90-7582-43f2-853d-bc1bad298b14",             // נסגר
  LOST: "e756c268-c0aa-48ab-87ce-6fea5ffdc0a5",            // לא נסגר
  DISQUALIFIED: "c60043c2-f34c-4256-89d8-717a3ed0cc58",    // לא רלוונטי
} as const;

// VSL pipeline stages
export const VSL_STAGE = {
  NEW: "a8f4cf35-0316-4be1-b828-ed175aeedc11",             // חדש
  BOOKED_MEETING: "0598682d-beaf-4261-8e9b-6a600f6c616c", // קבע פגישה
  INITIAL_CONTACT: "aff0f0bf-b07b-4379-9bdb-a7703ccb1641", // נוצר קשר ראשוני
  FOLLOWUP: "97bdd80d-9da3-4ff6-b466-d19d2e336575",        // פולואפ
  WON: "5201068c-dd85-42fd-afc2-2561c5029b0f",             // נסגר
  LOST: "f880ec82-064c-45fa-a10f-08973905d913",            // לא נסגר
  DISQUALIFIED: "87b89185-ff44-4c74-898f-59c42df32325",    // לא רלוונטי
} as const;

// ===== CRM contact.status values =====
type CrmStatus = "new" | "contacted" | "qualified" | "student" | "alumni" | "inactive";
type CrmSource =
  | "website" | "whatsapp" | "referral" | "facebook_ad"
  | "instagram" | "google_ad" | "workshop" | "manual" | "import";

// Numeric → text map (Fireberry returns numeric when querying with fields:"*", text otherwise)
const STATUSCODE_TO_TEXT: Record<number | string, string> = {
  1: "ליד חדש",
  2: "פולואפ",
  3: "נסגר",
  6: "לא נסגר",
  7: "לא רלוונטי",
};

// ===== Fireberry lead statuscode → CRM =====
export function mapLeadStatus(
  statuscode: string | number | undefined,
  statusText: string | undefined,
  pipeline: "webinar" | "vsl",
): { status: CrmStatus; stageId: string } {
  const stages = pipeline === "webinar" ? WEBINAR_STAGE : VSL_STAGE;
  const text = statusText || STATUSCODE_TO_TEXT[statuscode as any] || "";
  switch (text) {
    case "ליד חדש":   return { status: "new",       stageId: stages.NEW };
    case "פולואפ":    return { status: "contacted", stageId: stages.FOLLOWUP };
    case "לא נסגר":   return { status: "qualified", stageId: stages.LOST };
    case "נסגר":      return { status: "student",   stageId: stages.WON };
    case "לא רלוונטי": return { status: "inactive",  stageId: stages.DISQUALIFIED };
    default:
      return { status: "new", stageId: stages.NEW };
  }
}

// ===== Fireberry contact סטטוס (pcfsystemfield51name) → webinar pipeline stage =====
export function mapContactStage(statusName: string | undefined): {
  status: CrmStatus;
  stageId: string;
} {
  switch (statusName) {
    case "נרשם חדש":
      return { status: "new", stageId: WEBINAR_STAGE.NEW };
    case "נכח בוובינר":
      return { status: "contacted", stageId: WEBINAR_STAGE.ATTENDED_WEBINAR };
    case "קבע פגישה":
      return { status: "qualified", stageId: WEBINAR_STAGE.BOOKED_MEETING };
    default:
      return { status: "new", stageId: WEBINAR_STAGE.NEW };
  }
}

// ===== Fireberry "מקור הגעה" → CRM source =====
export function mapSource(fbSource: string | undefined): CrmSource {
  switch (fbSource) {
    case "דף נחיתה":   return "website";
    case "וובינר":     return "workshop";
    case "אינסטגרם":   return "instagram";
    case "פייסבוק":    return "facebook_ad";
    case "ווטסאפ":     return "whatsapp";
    case "הפנייה":     return "referral";
    case "אימייל":     return "manual";
    default:           return "import";
  }
}

// ===== Fireberry "מקור חשיפה" → CRM ad_platform =====
export function mapAdPlatform(exposure: string | undefined): "facebook" | "instagram" | "youtube" | "google" | "organic" | null {
  switch (exposure) {
    case "פייסבוק":   return "facebook";
    case "אינסטגרם":  return "instagram";
    case "וובינר":    return "organic";
    case "דף נחיתה":  return "organic";
    case "ווטסאפ":    return "organic";
    case "אימייל":    return "organic";
    case "הפנייה":    return "organic";
    default:          return null;
  }
}

// ===== Fireberry entry_type =====
export function mapEntryType(fbSource: string | undefined, hasWebinar: boolean): "vsl" | "webinar" | "organic" | "direct" {
  if (hasWebinar) return "webinar";
  if (fbSource === "דף נחיתה") return "vsl";
  return "direct";
}
