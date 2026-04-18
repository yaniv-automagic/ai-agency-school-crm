import { Router } from "express";
import { supabase } from "../lib/supabase.js";

export const webhookRouter = Router();

// ══════════════════════════════════════════════
// Fillout Webhook
// URL: POST /api/webhooks/fillout/:formId
// ══════════════════════════════════════════════
webhookRouter.post("/fillout/:formId", async (req, res) => {
  const { formId } = req.params;
  const payload = req.body;

  try {
    console.log(`[Fillout] Webhook for form ${formId}`);

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

    // Auto-detect fields
    for (const q of questions) {
      const name = (q.name || q.key || q.label || "").toLowerCase();
      const val = q.value ?? q.answer ?? q.text ?? "";
      if (!val) continue;
      if (name.includes("שם פרטי") || name.includes("first") || name === "name") contact.first_name = val;
      else if (name.includes("שם משפחה") || name.includes("last")) contact.last_name = val;
      else if (name.includes("מייל") || name.includes("email")) contact.email = val;
      else if (name.includes("טלפון") || name.includes("phone") || name.includes("נייד")) { contact.phone = val; contact.whatsapp_phone = val; }
      else if (name.includes("חברה") || name.includes("company")) contact.company = val;
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

    // Dedupe
    let contactId: string | null = null;
    if (contact.email) {
      const { data: ex } = await supabase.from("crm_contacts").select("id").eq("email", contact.email).single();
      if (ex) { contactId = ex.id; await supabase.from("crm_contacts").update({ ...contact, updated_at: new Date().toISOString() }).eq("id", contactId); }
    }
    if (!contactId && contact.phone) {
      const { data: ex } = await supabase.from("crm_contacts").select("id").eq("phone", contact.phone).single();
      if (ex) { contactId = ex.id; await supabase.from("crm_contacts").update({ ...contact, updated_at: new Date().toISOString() }).eq("id", contactId); }
    }
    if (!contactId) {
      const { data: nc } = await supabase.from("crm_contacts").insert(contact).select("id").single();
      contactId = nc?.id || null;
    }

    await supabase.from("crm_form_submissions").insert({ contact_id: contactId, data: payload, source_url: contact.landing_page_url, utm_params: urlParams });

    if (mapping?.auto_create_deal && contactId && mapping.pipeline_id && mapping.stage_id) {
      await supabase.from("crm_deals").insert({ contact_id: contactId, pipeline_id: mapping.pipeline_id, stage_id: mapping.stage_id, title: `ליד מ-${mapping.name || "Fillout"}`, product_id: mapping.product_id || null, status: "open", probability: 10 });
    }

    console.log(`[Fillout] Contact ${contactId} from form ${formId}`);
    res.json({ success: true, contactId });
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

    let contactId: string | null = null;
    if (contact.email) {
      const { data: ex } = await supabase.from("crm_contacts").select("id").eq("email", contact.email).single();
      if (ex) { contactId = ex.id; await supabase.from("crm_contacts").update({ ...contact, updated_at: new Date().toISOString() }).eq("id", contactId); }
    }
    if (!contactId) {
      const { data: nc } = await supabase.from("crm_contacts").insert(contact).select("id").single();
      contactId = nc?.id || null;
    }

    await supabase.from("crm_form_submissions").insert({ contact_id: contactId, data: payload, source_url: contact.landing_page_url, utm_params: { utm_source: contact.utm_source, utm_medium: contact.utm_medium, utm_campaign: contact.utm_campaign } });

    const { data: dp } = await supabase.from("crm_pipelines").select("id").eq("is_default", true).single();
    const { data: fs } = await supabase.from("crm_pipeline_stages").select("id").eq("pipeline_id", dp?.id).order("order_index").limit(1).single();
    if (contactId && dp && fs) {
      await supabase.from("crm_deals").insert({ contact_id: contactId, pipeline_id: dp.id, stage_id: fs.id, title: contact.entry_type === "webinar" ? "הרשמה לוובינר" : "ליד מדף נחיתה", status: "open", probability: 10 });
    }

    console.log(`[Elementor] Contact ${contactId}`);
    res.json({ success: true, contactId });
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
