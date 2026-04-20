import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase.js";

export const webhookRouter = Router();

// ── AI Summary Prompts ──

const MENTORING_SUMMARY_PROMPT = `אתה עוזר מקצועי לסיכום פגישות ליווי עסקי/מנטורינג.
תקבל תמלול מלא של פגישה ותפיק סיכום תמציתי ומדויק בעברית.

הפלט חייב להיות טקסט רגיל בלבד — בלי HTML, בלי markdown, בלי תגיות.

מבנה הפלט (עקוב במדויק):

שורה ראשונה: "פגישה [מספר אם ידוע] —"
שורה ריקה
פסקת סיכום: 2-5 משפטים רצופים.
שורה ריקה
"שיעורי בית:"
רשימה ממוספרת של משימות (1. משימה ראשונה  2. משימה שנייה  וכו')

הנחיות לתוכן:

פסקת הסיכום:
- כתוב בגוף שלישי ("נועה התקדמה...", "גיא בנה...")
- התחל בעדכון מצב כללי — מה קרה מאז הפגישה הקודמת, התקדמות, אתגרים
- המשך בתיאור מה נעשה בפגישה עצמה — נושאים, תרגילים, תובנות
- ציין לידים, פרויקטים, או הזדמנויות בשם ועם פרטים
- ציין חששות או קשיים שעלו
- טון ישיר, ענייני, וחם

שיעורי בית:
- כל משימה ברורה וספציפית
- ניסוח בצורת פועל במקור: לצפות, לבנות, לקדם, לדבר עם, למצוא, להגיע...
- שמות קורסים וכלים במירכאות או כשמם המדויק

כללי:
- אל תמציא מידע שלא מופיע בתמלול
- אל תוסיף פרשנויות או המלצות שלא נאמרו בפגישה
- אם שם המתלמד/ה לא ברור — כתוב [שם]
- הסיכום צריך להיות קצר מספיק לקריאה ב-30 שניות, אבל מפורט מספיק לזכור את הפגישה גם אחרי חודשים`;

const SALES_SUMMARY_PROMPT = `אתה מנתח שיחות מכירה מומחה. אתה מקבל תמלול מלא של שיחת מכירה (בעברית), ותפקידך לייצר סיכום מעמיק, ישיר וחד שמאפשר למוכר להבין בדיוק מה קרה בשיחה, למה הליד לא סגר (או סגר), ומה לעשות הלאה.

הפלט חייב להיות טקסט רגיל בלבד — בלי HTML, בלי markdown, בלי תגיות.
השתמש בשורות ריקות להפרדה בין סעיפים, ובאותיות גדולות או "---" להפרדה בין חלקים.

מבנה הסיכום:

למה לא סגר/ה? (או: למה כן סגר/ה?)
---
פסקה אחת תמציתית שמסבירה את השורה התחתונה: מה בדיוק מנע סגירה (או מה הוביל לסגירה). זו אבחנה ממוקדת. הפרד בין התנגדות אמיתית לבין תירוץ, וציין מה החסם האמיתי.

מה היה בשיחה:
---

טריגר רגשי:
מה מניע את הליד ברמה העמוקה? לא מה הוא אומר שהוא רוצה, אלא מה באמת דוחף אותו — פחד, שאיפה, כאב, חלום, תסכול, רצון להוכיח.

הבולשיט שניקינו:
אילו אמונות מגבילות, בלבולים או הנחות שגויות היו לליד, ואיך המוכר פירק אותם? דוגמאות ספציפיות.

הפער שעלה:
מה הפער המרכזי בין המצב הנוכחי של הליד לבין המצב הרצוי? חדד מה בדיוק הפער.

למה יש התאמה:
מה בליד הופך אותו למתאים? למה המוצר/שירות רלוונטי ספציפית עבורו?

מה חיזק את הביטחון / הערך:
אילו אלמנטים נתנו לליד תחושת ביטחון, אמון או התחברות?

החסם המרכזי:
מה באמת עוצר את הליד? הפרד בין חסמים שונים. זהה מה ראשי ומה משני.

הכאב שנגע בו/בה:
מה היה הרגע בשיחה שבו הליד הכי הרגיש שזה רלוונטי? אם לא היה רגע כזה — ציין.

שימור (מה נעשה טוב):
---
נקודות ספציפיות שהמוכר עשה טוב. כל נקודה — משפט-שניים שמסביר מה נעשה ולמה היה אפקטיבי.

שיפור (מה אפשר לעשות טוב יותר):
---
נקודות ספציפיות לשיפור. כל נקודה כוללת: מה היה אפשר אחרת, ולמה זה היה משנה. כולל המלצות לפולואפ.

סטטוס ליד:
---
שורה-שתיים: חם/קר/פושר, סגור/לא סגור, מה השלב הבא, מה נדרש. תאריך שיחת המשך אם נקבעה.

הנחיות כלליות:
- כתוב בעברית, בגוף שני (פנייה ישירה למוכר — "עשית", "חידדת", "הצגת")
- כשמתייחס לליד, השתמש בשם הפרטי שלו/שלה
- טון ישיר, מקצועי, כנה. שבחים רק כשמגיע, ביקורת בונה חדה וברורה
- אל תמציא מידע שלא עלה בשיחה
- אם יש מספרים (יעדי הכנסה, מחירים, מסלולים) — שלב אותם
- אם עלו שמות נוספים (בן/בת זוג, שותף) — ציין תפקידם
- שים לב להבדל בין מה שהליד אומר לבין מה שהוא מרגיש
- כתוב בפסקאות זורמות, לא ברשימות תבליטים. הסיכום צריך להיקרא כמו אנליזה רציפה`;

async function generateAISummary(
  transcript: string,
  meetingType: string,
  anthropicApiKey: string
): Promise<{ summary: string; actionItems: string[] }> {
  const client = new Anthropic({ apiKey: anthropicApiKey });
  const isSales = meetingType === "sales_consultation";
  const systemPrompt = isSales ? SALES_SUMMARY_PROMPT : MENTORING_SUMMARY_PROMPT;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: `תמלול הפגישה:\n\n${transcript}` }],
  });

  const summaryText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // Extract action items from the summary
  const actionItems: string[] = [];
  const lines = summaryText.split("\n");
  let inHomework = false;
  for (const line of lines) {
    if (line.includes("שיעורי בית:") || line.includes("שיפור")) {
      inHomework = true;
      continue;
    }
    if (inHomework) {
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match) {
        actionItems.push(match[1].trim());
      } else if (line.trim() === "" || line.includes("---")) {
        if (actionItems.length > 0) inHomework = false;
      }
    }
  }

  return { summary: summaryText, actionItems };
}

// ══════════════════════════════════════════════
// Fireflies.ai Webhook
// URL: POST /api/webhooks/fireflies/:tenantId
// ══════════════════════════════════════════════
webhookRouter.post("/fireflies/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const payload = req.body;

    console.log("[Fireflies] Webhook received:", JSON.stringify(payload).substring(0, 500));

    // Fireflies sends { meetingId, eventType, ... }
    const firefliesMeetingId = payload.meetingId || payload.meeting_id;
    const eventType = payload.eventType || payload.event_type || "Meeting Transcribed";

    if (!firefliesMeetingId) {
      return res.status(400).json({ error: "Missing meetingId" });
    }

    // Only process transcript-completed events
    if (eventType !== "Meeting Transcribed" && eventType !== "Transcription completed") {
      return res.json({ ok: true, skipped: true, reason: `Unhandled event: ${eventType}` });
    }

    // Get Fireflies API key from integration config
    const { data: ffConfig } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "fireflies")
      .eq("is_active", true)
      .single();

    if (!ffConfig?.config?.api_key) {
      console.error("[Fireflies] No API key configured for tenant", tenantId);
      return res.status(400).json({ error: "Fireflies API key not configured" });
    }

    const apiKey = ffConfig.config.api_key;

    // Fetch transcript details from Fireflies GraphQL API
    const gqlResponse = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `query GetTranscript($id: String!) {
          transcript(id: $id) {
            id
            title
            date
            duration
            organizer_email
            participants
            transcript_url
            audio_url
            video_url
            summary {
              overview
              shorthand_bullet
              action_items
            }
            sentences {
              speaker_name
              text
            }
          }
        }`,
        variables: { id: firefliesMeetingId },
      }),
    });

    const gqlData = await gqlResponse.json();
    const transcript = gqlData?.data?.transcript;

    if (!transcript) {
      console.error("[Fireflies] Transcript not found:", firefliesMeetingId, JSON.stringify(gqlData?.errors || gqlData).substring(0, 300));
      return res.status(404).json({ error: "Transcript not found in Fireflies" });
    }

    console.log(`[Fireflies] Got transcript: "${transcript.title}" (${transcript.sentences?.length || 0} sentences)`);

    // Build plain-text transcript from sentences
    const transcriptText = transcript.sentences
      ?.map((s: any) => `${s.speaker_name}: ${s.text}`)
      .join("\n") || "";

    const recordingUrl = transcript.video_url || transcript.audio_url || null;
    const transcriptUrl = transcript.transcript_url || null;
    const meetingDate = transcript.date ? new Date(transcript.date * 1000).toISOString() : new Date().toISOString();
    const durationMinutes = transcript.duration ? Math.round(transcript.duration / 60) : null;

    // Collect all participant emails
    const participantEmails: string[] = [];
    if (transcript.organizer_email) participantEmails.push(transcript.organizer_email.toLowerCase());
    if (transcript.participants) {
      for (const p of transcript.participants) {
        const email = (typeof p === "string" ? p : p?.email || "").toLowerCase().trim();
        if (email && !participantEmails.includes(email)) participantEmails.push(email);
      }
    }

    // Find matching contacts by email
    let matchedContacts: { id: string; email: string }[] = [];
    if (participantEmails.length > 0) {
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select("id, email")
        .eq("tenant_id", tenantId)
        .in("email", participantEmails);

      matchedContacts = contacts || [];
    }

    if (matchedContacts.length === 0) {
      console.log("[Fireflies] No matching contacts found for", participantEmails);
    }

    // Determine meeting type from existing meetings for this contact
    let meetingType = "other";
    const contactId = matchedContacts[0]?.id || null;
    if (contactId) {
      const { data: recentMeeting } = await supabase
        .from("crm_meetings")
        .select("meeting_type")
        .eq("contact_id", contactId)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .single();
      if (recentMeeting?.meeting_type) meetingType = recentMeeting.meeting_type;
    }

    // Generate AI summary using Claude
    let summary = "";
    let actionItems: string[] = [];

    const { data: anthropicConfig } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "anthropic")
      .eq("is_active", true)
      .single();

    const anthropicApiKey = anthropicConfig?.config?.api_key || process.env.ANTHROPIC_API_KEY;

    if (anthropicApiKey && transcriptText) {
      try {
        console.log(`[Fireflies] Generating AI summary (${meetingType}) for "${transcript.title}"...`);
        const aiResult = await generateAISummary(transcriptText, meetingType, anthropicApiKey);
        summary = aiResult.summary;
        actionItems = aiResult.actionItems;
        console.log(`[Fireflies] AI summary generated (${summary.length} chars, ${actionItems.length} action items)`);
      } catch (aiErr: any) {
        console.error("[Fireflies] AI summary failed, using Fireflies summary:", aiErr.message);
        summary = transcript.summary?.overview || transcript.summary?.shorthand_bullet?.join("\n") || "";
        actionItems = transcript.summary?.action_items || [];
      }
    } else {
      summary = transcript.summary?.overview || transcript.summary?.shorthand_bullet?.join("\n") || "";
      actionItems = transcript.summary?.action_items || [];
    }

    // Check if we already processed this Fireflies meeting
    const { data: existingMeeting } = await supabase
      .from("crm_meetings")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("fireflies_meeting_id", firefliesMeetingId)
      .limit(1)
      .single();

    if (existingMeeting) {
      await supabase
        .from("crm_meetings")
        .update({
          recording_url: recordingUrl,
          transcript_url: transcriptUrl,
          transcript_text: transcriptText,
          ai_summary: summary,
          ai_action_items: actionItems,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMeeting.id);
    } else if (contactId) {
      await supabase
        .from("crm_meetings")
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          meeting_type: meetingType as any,
          status: "completed",
          title: transcript.title || "פגישה מוקלטת",
          scheduled_at: meetingDate,
          duration_minutes: durationMinutes || 60,
          recording_url: recordingUrl,
          transcript_url: transcriptUrl,
          transcript_text: transcriptText,
          ai_summary: summary,
          ai_action_items: actionItems,
          fireflies_meeting_id: firefliesMeetingId,
        });
    }

    // Add activity to timeline for each matched contact
    const activityPromises = matchedContacts.map((contact) =>
      supabase.from("crm_activities").insert({
        tenant_id: tenantId,
        contact_id: contact.id,
        type: "meeting",
        subject: transcript.title || "הקלטת פגישה",
        body: summary || `תמלול פגישה זמין — ${transcript.title}`,
        metadata: {
          source: "fireflies",
          fireflies_meeting_id: firefliesMeetingId,
          recording_url: recordingUrl,
          transcript_url: transcriptUrl,
          duration_minutes: durationMinutes,
          participants: participantEmails,
          action_items: actionItems,
        },
        performed_at: meetingDate,
      })
    );

    await Promise.all(activityPromises);

    console.log(
      `[Fireflies] Processed transcript "${transcript.title}" → ${matchedContacts.length} contacts`
    );

    return res.json({
      ok: true,
      title: transcript.title,
      matchedContacts: matchedContacts.length,
      contactIds: matchedContacts.map((c) => c.id),
    });
  } catch (err: any) {
    console.error("[Fireflies] Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Normalize phone for dedup: +972... -> 0..., remove dashes/spaces
function normalizePhone(phone: string): string[] {
  const clean = phone.replace(/[-\s()]/g, "");
  const variants: string[] = [clean];
  if (clean.startsWith("+972")) variants.push("0" + clean.slice(4));
  else if (clean.startsWith("972")) variants.push("0" + clean.slice(3));
  else if (clean.startsWith("0")) variants.push("+972" + clean.slice(1), "972" + clean.slice(1));
  return variants;
}

// ══════════════════════════════════════════════
// Fillout Webhook
// URL: POST /api/webhooks/fillout/:formId
// ══════════════════════════════════════════════
webhookRouter.post("/fillout/:formId", async (req, res) => {
  const { formId } = req.params;
  const payload = req.body;

  try {
    // Log FULL raw payload for debugging
    console.log(`[Fillout] Webhook for form ${formId}`);
    console.log(`[Fillout] Raw payload keys: ${Object.keys(payload).join(', ')}`);
    console.log(`[Fillout] Raw payload: ${JSON.stringify(payload).substring(0, 1000)}`);

    const { data: mapping } = await supabase
      .from("crm_fillout_form_mappings")
      .select("*")
      .eq("fillout_form_id", formId)
      .eq("is_active", true)
      .single();

    const submission = payload.submission || payload.submissions?.[0] || payload;
    const questions = submission.questions || submission.answers || submission.fields || [];
    const urlParams = submission.urlParameters || payload.urlParameters || {};

    const contact: Record<string, any> = {
      source: mapping?.source_tag || "website",
      status: "new",
      first_touch_at: new Date().toISOString(),
    };

    // Auto-detect fields + detect meeting-related fields
    let isMeetingForm = false;
    let meetingDate: string | null = null;

    for (const q of questions) {
      const name = (q.name || q.key || q.label || "").toLowerCase();
      const val = q.value ?? q.answer ?? q.text ?? "";
      if (!val) continue;
      if (name.includes("שם פרטי") || name.includes("first") || name === "name") contact.first_name = val;
      else if (name.includes("שם משפחה") || name.includes("last")) contact.last_name = val;
      else if (name.includes("מייל") || name.includes("email")) contact.email = val;
      else if (name.includes("טלפון") || name.includes("phone") || name.includes("נייד")) { contact.phone = val; contact.whatsapp_phone = val; }
      else if (name.includes("חברה") || name.includes("company")) contact.company = val;

      // Detect meeting/scheduling fields
      if (name.includes("פגישה") || name.includes("meeting") || name.includes("תאריך") || name.includes("date") || name.includes("schedule") || name.includes("מועד") || name.includes("זמן") || name.includes("time")) {
        isMeetingForm = true;
        if (val && (name.includes("תאריך") || name.includes("date") || name.includes("מועד") || name.includes("time") || name.includes("זמן") || name.includes("schedule"))) {
          meetingDate = val;
        }
      }
    }

    // Also detect by landing page URL containing "meeting"
    const pageUrl = urlParams.page_url || urlParams.referrer || "";
    if (pageUrl.includes("meeting") || pageUrl.includes("פגישה") || pageUrl.includes("calendar")) {
      isMeetingForm = true;
    }

    // Mapping overrides
    if (mapping?.field_mappings) {
      for (const [ff, cf] of Object.entries(mapping.field_mappings)) {
        const q = questions.find((q: any) => q.id === ff || q.key === ff || q.name === ff);
        if (q) contact[cf as string] = q.value ?? q.answer ?? q.text;
      }
    }

    // UTM params (inherit-parameters passes these automatically)
    if (urlParams.utm_source) contact.utm_source = urlParams.utm_source;
    if (urlParams.utm_medium) contact.utm_medium = urlParams.utm_medium;
    if (urlParams.utm_campaign) contact.utm_campaign = urlParams.utm_campaign;
    if (urlParams.utm_content) contact.utm_content = urlParams.utm_content;
    if (urlParams.utm_term) contact.utm_term = urlParams.utm_term;
    if (urlParams.ad_id) contact.ad_id = urlParams.ad_id;
    if (urlParams.adset_id) contact.ad_adset_id = urlParams.adset_id;
    if (urlParams.campaign_id) contact.ad_campaign_id = urlParams.campaign_id;

    // Detect platform
    const src = (urlParams.utm_source || "").toLowerCase();
    if (src.includes("facebook") || src.includes("fb") || src.includes("meta") || urlParams.fbclid) contact.ad_platform = "facebook";
    else if (src.includes("instagram") || src.includes("ig")) contact.ad_platform = "instagram";
    else if (src.includes("google") || urlParams.gclid) contact.ad_platform = "google";
    else if (src.includes("youtube") || src.includes("yt")) contact.ad_platform = "youtube";

    contact.entry_type = mapping?.entry_type || urlParams.entry_type || urlParams.ref || "vsl";
    contact.landing_page_url = urlParams.page_url || urlParams.referrer || null;
    contact.referrer_url = urlParams.referrer || null;

    if (contact.utm_source && !contact.source) contact.source = "facebook_ad";
    if (!contact.first_name) contact.first_name = "ליד";
    if (!contact.last_name) contact.last_name = "חדש";

    // Auto-assign pipeline stage: meeting form → landing page mapping → entry_type → default
    const { data: allPipelines } = await supabase.from("crm_pipelines").select("id, name, default_stage_id");
    const { data: allStages } = await supabase.from("crm_pipeline_stages").select("id, pipeline_id, name, order_index").order("order_index");

    if (isMeetingForm) {
      // Meeting form: find the "קבע פגישה" stage in any pipeline
      const meetingStage = allStages?.find(s => s.name.includes("קבע פגישה") || s.name.includes("פגישה"));
      if (meetingStage) {
        contact.stage_id = meetingStage.id;
      }
    } else if (mapping?.pipeline_id && mapping?.stage_id) {
      contact.stage_id = mapping.stage_id;
    } else {
      // 1. Check landing page mappings
      const landingUrl = contact.landing_page_url || "";
      if (landingUrl) {
        const { data: lpMappings } = await supabase.from("crm_landing_page_mappings").select("*");
        const matched = lpMappings?.find(m => landingUrl.includes(m.url_pattern) || m.url_pattern.includes(landingUrl.split("?")[0]));
        if (matched?.pipeline_id) {
          contact.stage_id = matched.stage_id || matched.pipeline_id && allStages?.find(s => s.pipeline_id === matched.pipeline_id)?.id || null;
        }
      }

      // 2. Fallback: match by entry_type
      if (!contact.stage_id) {
        const entryType = (contact.entry_type || "").toLowerCase();
        let matchedPipeline = null;
        if (entryType === "webinar" || entryType === "וובינר") {
          matchedPipeline = allPipelines?.find(p => p.name.includes("וובינר") || p.name.toLowerCase().includes("webinar"));
        } else if (entryType === "vsl") {
          matchedPipeline = allPipelines?.find(p => p.name.toLowerCase().includes("vsl"));
        }
        if (!matchedPipeline) {
          matchedPipeline = allPipelines?.find(p => (p as any).is_default) || allPipelines?.[0];
        }
        if (matchedPipeline) {
          contact.stage_id = matchedPipeline.default_stage_id || allStages?.find(s => s.pipeline_id === matchedPipeline!.id)?.id || null;
        }
      }
    }

    // Dedupe: find existing contact by email or phone (with normalization)
    let contactId: string | null = null;
    let existingContact: any = null;

    if (contact.email) {
      const { data: ex } = await supabase.from("crm_contacts").select("*").eq("email", contact.email).single();
      if (ex) { contactId = ex.id; existingContact = ex; }
    }
    if (!contactId && contact.phone) {
      const phoneVariants = normalizePhone(contact.phone);
      for (const variant of phoneVariants) {
        const { data: ex } = await supabase.from("crm_contacts").select("*").eq("phone", variant).single();
        if (ex) { contactId = ex.id; existingContact = ex; break; }
      }
    }

    if (existingContact) {
      // EXISTING contact: update info but PRESERVE first-touch attribution
      // Only overwrite UTMs if the existing contact doesn't have them yet
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };

      // Always update basic info
      if (contact.first_name && contact.first_name !== "ליד") updates.first_name = contact.first_name;
      if (contact.last_name && contact.last_name !== "חדש") updates.last_name = contact.last_name;
      if (contact.phone) updates.phone = contact.phone;
      if (contact.whatsapp_phone) updates.whatsapp_phone = contact.whatsapp_phone;
      if (contact.company) updates.company = contact.company;

      // First-touch attribution: only set if not already set
      if (!existingContact.utm_source && contact.utm_source) updates.utm_source = contact.utm_source;
      if (!existingContact.utm_medium && contact.utm_medium) updates.utm_medium = contact.utm_medium;
      if (!existingContact.utm_campaign && contact.utm_campaign) updates.utm_campaign = contact.utm_campaign;
      if (!existingContact.utm_content && contact.utm_content) updates.utm_content = contact.utm_content;
      if (!existingContact.utm_term && contact.utm_term) updates.utm_term = contact.utm_term;
      if (!existingContact.ad_platform && contact.ad_platform) updates.ad_platform = contact.ad_platform;
      if (!existingContact.entry_type && contact.entry_type) updates.entry_type = contact.entry_type;
      if (!existingContact.ad_campaign_id && contact.ad_campaign_id) updates.ad_campaign_id = contact.ad_campaign_id;
      if (!existingContact.ad_adset_id && contact.ad_adset_id) updates.ad_adset_id = contact.ad_adset_id;
      if (!existingContact.ad_id && contact.ad_id) updates.ad_id = contact.ad_id;
      if (!existingContact.first_touch_at) updates.first_touch_at = contact.first_touch_at;
      if (!existingContact.landing_page_url && contact.landing_page_url) updates.landing_page_url = contact.landing_page_url;

      // Meeting form: always advance stage to "קבע פגישה"
      if (isMeetingForm && contact.stage_id) {
        updates.stage_id = contact.stage_id;
      } else if (!existingContact.stage_id && contact.stage_id) {
        updates.stage_id = contact.stage_id;
      }

      // Conversion timestamp: update on each submission (last touch)
      updates.conversion_at = new Date().toISOString();

      await supabase.from("crm_contacts").update(updates).eq("id", contactId);
      console.log(`[Fillout] Updated existing contact ${contactId}`);
    } else {
      // NEW contact
      const { data: nc } = await supabase.from("crm_contacts").insert(contact).select("id").single();
      contactId = nc?.id || null;
      console.log(`[Fillout] Created new contact ${contactId}`);
    }

    // Save form submission
    await supabase.from("crm_form_submissions").insert({ contact_id: contactId, data: payload, source_url: contact.landing_page_url, utm_params: urlParams });

    // Log as activity in timeline (visible in contact detail page)
    if (contactId) {
      const formName = mapping?.name || formId;
      const isReturning = !!existingContact;
      const utmInfo = [
        urlParams.utm_source && `source: ${urlParams.utm_source}`,
        urlParams.utm_campaign && `campaign: ${urlParams.utm_campaign}`,
        contact.entry_type && `entry: ${contact.entry_type}`,
      ].filter(Boolean).join(" | ");

      const activitySubject = isMeetingForm
        ? (isReturning ? "קבע פגישה" : "קבע פגישה")
        : (isReturning ? `השאיר פרטים שוב — ${formName}` : `השאיר פרטים — ${formName}`);

      const activityBody = isMeetingForm
        ? [
            "הליד קבע פגישה",
            meetingDate && `מועד: ${meetingDate}`,
            contact.landing_page_url && `דף: ${contact.landing_page_url}`,
          ].filter(Boolean).join("\n")
        : [
            isReturning ? "ליד חוזר — השאיר פרטים שוב" : "ליד חדש — השאיר פרטים לראשונה",
            utmInfo && `שיוך: ${utmInfo}`,
            contact.landing_page_url && `דף: ${contact.landing_page_url}`,
          ].filter(Boolean).join("\n");

      await supabase.from("crm_activities").insert({
        contact_id: contactId,
        type: isMeetingForm ? "meeting" : "system",
        subject: activitySubject,
        body: activityBody,
        metadata: {
          form_type: "fillout",
          form_id: formId,
          form_name: formName,
          is_meeting: isMeetingForm,
          meeting_date: meetingDate,
          is_returning: isReturning,
          utm_source: urlParams.utm_source || null,
          utm_campaign: urlParams.utm_campaign || null,
          entry_type: contact.entry_type || null,
        },
      });
    }

    // Create meeting record if it's a meeting form
    if (isMeetingForm && contactId) {
      const scheduledAt = meetingDate ? new Date(meetingDate).toISOString() : new Date(Date.now() + 86400000).toISOString();
      await supabase.from("crm_meetings").insert({
        contact_id: contactId,
        title: `פגישה עם ${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
        meeting_type: "sales_consultation",
        status: "scheduled",
        scheduled_at: scheduledAt,
        duration_minutes: 30,
        fillout_submission_id: formId,
      });
      console.log(`[Fillout] Created meeting for contact ${contactId}`);
    }

    console.log(`[Fillout] Contact ${contactId} (${existingContact ? 'updated' : 'new'}) ${isMeetingForm ? '[MEETING]' : '[FORM]'} from ${formId}`);
    res.json({ success: true, contactId, isNew: !existingContact });
  } catch (err: any) {
    console.error("[Fillout] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════
// Elementor Form Webhook
// URL: POST /api/webhooks/elementor
// ══════════════════════════════════════════════
webhookRouter.post("/elementor", async (req, res) => {
  const payload = req.body;
  try {
    console.log("[Elementor] Webhook received");
    const contact: Record<string, any> = { source: "website", status: "new", first_touch_at: new Date().toISOString() };

    const fields = payload.fields || payload;
    for (const [key, value] of Object.entries(fields)) {
      if (!value) continue;
      const k = String(key).toLowerCase(); const v = String(value);
      if (k.includes("שם") || k === "name" || k.includes("full")) { const p = v.split(" "); contact.first_name = p[0]; contact.last_name = p.slice(1).join(" ") || ""; }
      else if (k.includes("email") || k.includes("מייל")) contact.email = v;
      else if (k.includes("phone") || k.includes("טלפון") || k.includes("נייד")) { contact.phone = v; contact.whatsapp_phone = v; }
    }

    const meta = payload.meta || {};
    if (meta.utm_source || payload.utm_source) contact.utm_source = meta.utm_source || payload.utm_source;
    if (meta.utm_medium || payload.utm_medium) contact.utm_medium = meta.utm_medium || payload.utm_medium;
    if (meta.utm_campaign || payload.utm_campaign) contact.utm_campaign = meta.utm_campaign || payload.utm_campaign;
    if (meta.utm_content || payload.utm_content) contact.utm_content = meta.utm_content || payload.utm_content;
    contact.landing_page_url = meta.page_url || payload.page_url || null;
    contact.referrer_url = meta.referrer || payload.referrer || null;

    const url = contact.landing_page_url || "";
    if (url.includes("vsl")) contact.entry_type = "vsl";
    else if (url.includes("webinar")) contact.entry_type = "webinar";

    const utmSrc = (contact.utm_source || "").toLowerCase();
    if (utmSrc.includes("facebook") || utmSrc.includes("fb")) { contact.ad_platform = "facebook"; contact.source = "facebook_ad"; }
    else if (utmSrc.includes("instagram")) { contact.ad_platform = "instagram"; contact.source = "instagram"; }
    else if (utmSrc.includes("google")) { contact.ad_platform = "google"; contact.source = "google_ad"; }

    if (!contact.first_name) contact.first_name = "ליד";
    if (!contact.last_name) contact.last_name = "";

    // Auto-assign pipeline stage: landing page mapping → entry_type → default
    const { data: elPipelines } = await supabase.from("crm_pipelines").select("id, name, default_stage_id");
    const { data: elStages } = await supabase.from("crm_pipeline_stages").select("id, pipeline_id, order_index").order("order_index");

    // 1. Check landing page mappings
    const elLandingUrl = contact.landing_page_url || "";
    if (elLandingUrl) {
      const { data: elLpMappings } = await supabase.from("crm_landing_page_mappings").select("*");
      const elMatched = elLpMappings?.find(m => elLandingUrl.includes(m.url_pattern) || m.url_pattern.includes(elLandingUrl.split("?")[0]));
      if (elMatched?.pipeline_id) {
        contact.stage_id = elMatched.stage_id || elStages?.find(s => s.pipeline_id === elMatched.pipeline_id)?.id || null;
      }
    }

    // 2. Fallback: match by entry_type
    if (!contact.stage_id) {
      const entryType = (contact.entry_type || "").toLowerCase();
      let elPipeline = null;
      if (entryType === "webinar" || entryType === "וובינר") {
        elPipeline = elPipelines?.find(p => p.name.includes("וובינר") || p.name.toLowerCase().includes("webinar"));
      } else if (entryType === "vsl") {
        elPipeline = elPipelines?.find(p => p.name.toLowerCase().includes("vsl"));
      }
      if (!elPipeline) {
        elPipeline = elPipelines?.find(p => (p as any).is_default) || elPipelines?.[0];
      }
      if (elPipeline) {
        contact.stage_id = elPipeline.default_stage_id || elStages?.find(s => s.pipeline_id === elPipeline!.id)?.id || null;
      }
    }

    // Dedupe by email or phone (with normalization)
    let contactId: string | null = null;
    let isReturning = false;
    let existingEl: any = null;

    if (contact.email) {
      const { data: ex } = await supabase.from("crm_contacts").select("*").eq("email", contact.email).single();
      if (ex) { existingEl = ex; contactId = ex.id; isReturning = true; }
    }
    if (!contactId && contact.phone) {
      const phoneVariants = normalizePhone(contact.phone);
      for (const variant of phoneVariants) {
        const { data: ex } = await supabase.from("crm_contacts").select("*").eq("phone", variant).single();
        if (ex) { existingEl = ex; contactId = ex.id; isReturning = true; break; }
      }
    }

    if (existingEl) {
      // Update existing - preserve first-touch attribution
      const updates: Record<string, any> = { updated_at: new Date().toISOString(), conversion_at: new Date().toISOString() };
      if (contact.first_name && contact.first_name !== "ליד") updates.first_name = contact.first_name;
      if (contact.phone) updates.phone = contact.phone;
      if (!existingEl.utm_source && contact.utm_source) updates.utm_source = contact.utm_source;
      if (!existingEl.utm_medium && contact.utm_medium) updates.utm_medium = contact.utm_medium;
      if (!existingEl.utm_campaign && contact.utm_campaign) updates.utm_campaign = contact.utm_campaign;
      if (!existingEl.ad_platform && contact.ad_platform) updates.ad_platform = contact.ad_platform;
      if (!existingEl.entry_type && contact.entry_type) updates.entry_type = contact.entry_type;
      if (!existingEl.landing_page_url && contact.landing_page_url) updates.landing_page_url = contact.landing_page_url;
      if (!existingEl.stage_id && contact.stage_id) updates.stage_id = contact.stage_id;
      await supabase.from("crm_contacts").update(updates).eq("id", contactId);
    }
    if (!contactId) {
      const { data: nc } = await supabase.from("crm_contacts").insert(contact).select("id").single();
      contactId = nc?.id || null;
    }

    // Save submission
    await supabase.from("crm_form_submissions").insert({ contact_id: contactId, data: payload, source_url: contact.landing_page_url, utm_params: { utm_source: contact.utm_source, utm_medium: contact.utm_medium, utm_campaign: contact.utm_campaign } });

    // Timeline activity
    if (contactId) {
      const pagePath = (contact.landing_page_url || "").replace("https://aiagencyschool.co.il", "");
      const formType = pagePath.includes("vsl") ? "VSL" : pagePath.includes("webinar") ? "וובינר" : "דף נחיתה";
      await supabase.from("crm_activities").insert({
        contact_id: contactId,
        type: "system",
        subject: isReturning ? `השלים טופס שוב — ${formType}` : `השלים טופס — ${formType}`,
        body: [
          isReturning ? "ליד חוזר" : "ליד חדש",
          contact.utm_source && `מקור: ${contact.utm_source}`,
          contact.utm_campaign && `קמפיין: ${contact.utm_campaign}`,
          pagePath && `דף: ${pagePath}`,
        ].filter(Boolean).join("\n"),
        metadata: { form_type: "elementor", is_returning: isReturning, utm_source: contact.utm_source },
      });
    }

    // Update stage_id on existing contacts without one
    if (isReturning && contact.stage_id && contactId) {
      const { data: exContact } = await supabase.from("crm_contacts").select("stage_id").eq("id", contactId).single();
      if (exContact && !exContact.stage_id) {
        await supabase.from("crm_contacts").update({ stage_id: contact.stage_id }).eq("id", contactId);
      }
    }

    console.log(`[Elementor] Contact ${contactId} (${isReturning ? 'returning' : 'new'})`);
    res.json({ success: true, contactId, isNew: !isReturning });
  } catch (err: any) {
    console.error("[Elementor]", err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════
// Tracking Pixel (enriches existing contacts with UTM data)
// URL: POST /api/webhooks/track
// ══════════════════════════════════════════════
webhookRouter.post("/track", async (req, res) => {
  try {
    const { email, phone, utm_source, utm_medium, utm_campaign, utm_content, utm_term, page_url, referrer, entry_type, fbclid, gclid } = req.body;
    if (!email && !phone) return res.json({ ok: true });

    const u: Record<string, any> = { updated_at: new Date().toISOString() };
    if (utm_source) u.utm_source = utm_source;
    if (utm_medium) u.utm_medium = utm_medium;
    if (utm_campaign) u.utm_campaign = utm_campaign;
    if (utm_content) u.utm_content = utm_content;
    if (utm_term) u.utm_term = utm_term;
    if (page_url) u.landing_page_url = page_url;
    if (referrer) u.referrer_url = referrer;
    if (entry_type) u.entry_type = entry_type;

    const src = (utm_source || "").toLowerCase();
    if (src.includes("facebook") || src.includes("fb") || fbclid) u.ad_platform = "facebook";
    else if (src.includes("google") || gclid) u.ad_platform = "google";

    if (email) await supabase.from("crm_contacts").update(u).eq("email", email);
    else if (phone) await supabase.from("crm_contacts").update(u).eq("phone", phone);

    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// ══════════════════════════════════════════════
// Debug: log any payload (temporary)
// URL: POST /api/webhooks/debug
// ══════════════════════════════════════════════
webhookRouter.post("/debug", async (req, res) => {
  console.log("[Debug] Headers:", JSON.stringify(req.headers).substring(0, 300));
  console.log("[Debug] Body:", JSON.stringify(req.body).substring(0, 2000));

  // Save to webhook_logs for inspection
  try {
    await supabase.from("crm_webhook_logs").insert({
      payload: req.body,
      headers: { "content-type": req.headers["content-type"], "user-agent": req.headers["user-agent"] } as any,
      status: "processed",
    });
  } catch {};

  res.json({ received: true, keys: Object.keys(req.body) });
});

// ══════════════════════════════════════════════
// Generic Webhook
// URL: POST /api/webhooks/incoming/:slug
// ══════════════════════════════════════════════
webhookRouter.post("/incoming/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const { data: wh } = await supabase.from("crm_webhooks").select("*").eq("slug", slug).eq("is_active", true).single();
    if (!wh) return res.status(404).json({ error: "Not found" });
    await supabase.from("crm_webhook_logs").insert({ webhook_id: wh.id, payload: req.body, headers: req.headers as any, status: "processed" });
    await supabase.from("crm_webhooks").update({ last_received_at: new Date().toISOString() }).eq("id", wh.id);
    await supabase.from("crm_automation_queue").insert({ event_type: "webhook.received", record_type: "webhooks", record_id: wh.id, new_data: req.body });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
