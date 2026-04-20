import { Router, Request, Response } from "express";
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

// ── Fireflies.ai webhook — receives transcript-ready events ──
webhookRouter.post("/fireflies/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const payload = req.body;

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
    const { data: config } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "fireflies")
      .eq("is_active", true)
      .single();

    if (!config?.config?.api_key) {
      console.error("[Fireflies] No API key configured for tenant", tenantId);
      return res.status(400).json({ error: "Fireflies API key not configured" });
    }

    const apiKey = config.config.api_key;

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
      console.error("[Fireflies] Transcript not found:", firefliesMeetingId);
      return res.status(404).json({ error: "Transcript not found in Fireflies" });
    }

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

    // Fallback: try matching by name from transcript title
    if (matchedContacts.length === 0 && transcript.title) {
      console.log("[Fireflies] No email match, trying name match from title:", transcript.title);
      const titleParts = transcript.title.split(/[-–—:,]/)[0].trim();
      const names = titleParts.split(/\s+ו/).flatMap((n: string) => n.trim().split(/\s+/)).filter((n: string) => n.length > 1);
      if (names.length > 0) {
        const { data: allContacts } = await supabase
          .from("crm_contacts")
          .select("id, email, first_name, last_name")
          .eq("tenant_id", tenantId);
        if (allContacts) {
          for (const contact of allContacts) {
            const firstName = (contact.first_name || "").toLowerCase();
            const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim().toLowerCase();
            for (const name of names) {
              if (name.length > 1 && (firstName === name.toLowerCase() || fullName.includes(name.toLowerCase()))) {
                if (!matchedContacts.find(c => c.id === contact.id)) {
                  matchedContacts.push({ id: contact.id, email: contact.email || "" });
                }
              }
            }
          }
        }
      }
    }

    if (matchedContacts.length === 0) {
      console.log("[Fireflies] No matching contacts found for", participantEmails);
    }

    // Determine meeting type: check if there's an existing meeting for this contact
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

    // Generate AI summary using Claude (Sonnet 4)
    let summary = "";
    let actionItems: string[] = [];

    // Check if tenant has an Anthropic API key configured
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
        // Fallback to Fireflies native summary
        summary = transcript.summary?.overview || transcript.summary?.shorthand_bullet?.join("\n") || "";
        actionItems = transcript.summary?.action_items || [];
      }
    } else {
      // No API key — use Fireflies native summary
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
      // Update existing meeting with transcript data
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
      // Create new meeting record linked to the first matched contact
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

// ── Generic webhook endpoint for external services (Zapier, Make, etc.) ──
webhookRouter.post("/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const apiKey = req.headers["x-api-key"] as string;

    // Verify API key
    const { data: config } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "webhooks")
      .single();

    if (!config?.config?.["api-key"] || config.config["api-key"] !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const payload = req.body;
    const action = payload.action || "create_contact";

    if (action === "create_contact") {
      // Auto-assign pipeline stage
      let stageId = payload.stage_id || null;
      if (!stageId) {
        const entryType = (payload.entry_type || "").toLowerCase();
        const { data: pls } = await supabase.from("crm_pipelines").select("id, name, default_stage_id").eq("tenant_id", tenantId);
        const { data: sts } = await supabase.from("crm_pipeline_stages").select("id, pipeline_id, order_index").order("order_index");
        let matched = null;
        if (entryType === "webinar") matched = pls?.find(p => p.name.includes("וובינר") || p.name.toLowerCase().includes("webinar"));
        else if (entryType === "vsl") matched = pls?.find(p => p.name.toLowerCase().includes("vsl"));
        if (!matched) matched = pls?.find(p => (p as any).is_default) || pls?.[0];
        if (matched) stageId = matched.default_stage_id || sts?.find(s => s.pipeline_id === matched!.id)?.id || null;
      }

      const contactData = {
        tenant_id: tenantId,
        first_name: payload.first_name || "",
        last_name: payload.last_name || "",
        email: payload.email || null,
        phone: payload.phone || null,
        company: payload.company || null,
        source: payload.source || "manual",
        status: "new" as const,
        stage_id: stageId,
        tags: payload.tags || [],
        custom_fields: payload.custom_fields || {},
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
      };

      const { data, error } = await supabase
        .from("crm_contacts")
        .insert(contactData)
        .select("id")
        .single();

      if (error) throw error;
      return res.json({ ok: true, contactId: data!.id });
    }

    if (action === "create_deal") {
      const { data, error } = await supabase
        .from("crm_deals")
        .insert({
          tenant_id: tenantId,
          contact_id: payload.contact_id,
          pipeline_id: payload.pipeline_id,
          stage_id: payload.stage_id,
          title: payload.title || "New Deal",
          value: payload.value || 0,
          currency: payload.currency || "ILS",
          status: "open",
          stage_entered_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return res.json({ ok: true, dealId: data!.id });
    }

    if (action === "add_activity") {
      const { error } = await supabase.from("crm_activities").insert({
        tenant_id: tenantId,
        contact_id: payload.contact_id,
        type: payload.type || "note",
        direction: payload.direction || null,
        subject: payload.subject || "",
        body: payload.body || "",
        performed_at: new Date().toISOString(),
      });

      if (error) throw error;
      return res.json({ ok: true });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Fillout.io form webhook ──
webhookRouter.post("/fillout/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const submission = req.body;
    const formId = submission.formId || submission.form_id;

    // Get form mapping
    const { data: mapping } = await supabase
      .from("crm_fillout_form_mappings")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("fillout_form_id", formId)
      .eq("is_active", true)
      .single();

    if (!mapping) {
      return res.status(404).json({ error: "Form mapping not found" });
    }

    // Map fields
    // Auto-assign pipeline stage
    let srvStageId: string | null = null;
    if (mapping.stage_id) {
      srvStageId = mapping.stage_id;
    } else {
      const et = (mapping.entry_type || "").toLowerCase();
      const { data: srvPls } = await supabase.from("crm_pipelines").select("id, name, default_stage_id").eq("tenant_id", tenantId);
      const { data: srvSts } = await supabase.from("crm_pipeline_stages").select("id, pipeline_id, order_index").order("order_index");
      let srvMatched = null;
      if (et === "webinar") srvMatched = srvPls?.find(p => p.name.includes("וובינר") || p.name.toLowerCase().includes("webinar"));
      else if (et === "vsl") srvMatched = srvPls?.find(p => p.name.toLowerCase().includes("vsl"));
      if (!srvMatched) srvMatched = srvPls?.find(p => (p as any).is_default) || srvPls?.[0];
      if (srvMatched) srvStageId = srvMatched.default_stage_id || srvSts?.find(s => s.pipeline_id === srvMatched!.id)?.id || null;
    }

    const contactData: Record<string, any> = {
      tenant_id: tenantId,
      source: "website",
      status: "new",
      stage_id: srvStageId,
      tags: [mapping.source_tag],
      entry_type: mapping.entry_type,
      custom_fields: {},
    };

    const questions = submission.questions || [];
    for (const q of questions) {
      const fieldId = q.id || q.key;
      const mappedField = mapping.field_mappings?.[fieldId];
      if (mappedField) {
        contactData[mappedField] = q.value;
      }

      // UTM mappings
      const utmField = mapping.utm_field_mappings?.[fieldId];
      if (utmField) {
        contactData[utmField] = q.value;
      }
    }

    // Upsert contact
    let contactId: string;
    if (contactData.email) {
      const { data: existing } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", contactData.email)
        .limit(1)
        .single();

      if (existing) {
        await supabase.from("crm_contacts").update(contactData).eq("id", existing.id);
        contactId = existing.id;
      } else {
        const { data } = await supabase.from("crm_contacts").insert(contactData).select("id").single();
        contactId = data!.id;
      }
    } else {
      const { data } = await supabase.from("crm_contacts").insert(contactData).select("id").single();
      contactId = data!.id;
    }

    // Update stage_id on existing contacts without one
    if (contactData.email && srvStageId) {
      const { data: exC } = await supabase.from("crm_contacts").select("stage_id").eq("id", contactId).single();
      if (exC && !exC.stage_id) {
        await supabase.from("crm_contacts").update({ stage_id: srvStageId }).eq("id", contactId);
      }
    }

    res.json({ ok: true, contactId });
  } catch (err: any) {
    console.error("Fillout webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});
