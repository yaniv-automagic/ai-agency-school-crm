import { Router } from "express";
import { supabase } from "../lib/supabase.js";

export const webhookRouter = Router();

// ── Fillout Webhook ──
// Receives form submissions from Fillout and creates contacts
webhookRouter.post("/fillout/:formId", async (req, res) => {
  const { formId } = req.params;
  const payload = req.body;

  try {
    // Find mapping config for this form
    const { data: mapping } = await supabase
      .from("crm_fillout_form_mappings")
      .select("*")
      .eq("fillout_form_id", formId)
      .eq("is_active", true)
      .single();

    if (!mapping) {
      return res.status(404).json({ error: "Form mapping not found" });
    }

    // Extract fields from Fillout payload
    const answers = payload.questions || payload.answers || payload.fields || [];
    const contactData: Record<string, any> = {
      source: "website",
      status: "new",
    };

    // Map Fillout fields to CRM fields
    const fieldMappings = mapping.field_mappings || {};
    for (const [filloutField, crmField] of Object.entries(fieldMappings)) {
      const answer = answers.find((a: any) =>
        a.id === filloutField || a.key === filloutField || a.name === filloutField
      );
      if (answer) {
        contactData[crmField as string] = answer.value || answer.answer || answer.text;
      }
    }

    // Extract UTM params
    const utmMappings = mapping.utm_field_mappings || {};
    for (const [filloutField, utmField] of Object.entries(utmMappings)) {
      const answer = answers.find((a: any) =>
        a.id === filloutField || a.key === filloutField || a.name === filloutField
      );
      if (answer) {
        contactData[utmField as string] = answer.value || answer.answer;
      }
    }

    // URL params from Fillout (they often pass UTMs in urlParameters)
    if (payload.urlParameters) {
      const params = payload.urlParameters;
      if (params.utm_source) contactData.utm_source = params.utm_source;
      if (params.utm_medium) contactData.utm_medium = params.utm_medium;
      if (params.utm_campaign) contactData.utm_campaign = params.utm_campaign;
      if (params.utm_content) contactData.utm_content = params.utm_content;
      if (params.utm_term) contactData.utm_term = params.utm_term;
    }

    // Set entry type and source tag
    contactData.entry_type = mapping.entry_type || "vsl";
    if (mapping.source_tag) contactData.source = mapping.source_tag;
    contactData.first_touch_at = new Date().toISOString();

    // Check for existing contact by email
    let contactId: string | null = null;
    if (contactData.email) {
      const { data: existing } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("email", contactData.email)
        .single();

      if (existing) {
        contactId = existing.id;
        // Update existing contact with any new data
        await supabase.from("crm_contacts").update(contactData).eq("id", contactId);
      }
    }

    // Create new contact if none exists
    if (!contactId) {
      if (!contactData.first_name) contactData.first_name = "ליד";
      if (!contactData.last_name) contactData.last_name = "חדש";

      const { data: newContact } = await supabase
        .from("crm_contacts")
        .insert(contactData)
        .select("id")
        .single();
      contactId = newContact?.id || null;
    }

    // Save form submission
    await supabase.from("crm_form_submissions").insert({
      form_id: null, // Fillout forms don't have a CRM form_id
      contact_id: contactId,
      data: payload,
      source_url: payload.pageUrl || null,
      utm_params: payload.urlParameters || null,
    });

    // Auto-create deal if configured
    if (mapping.auto_create_deal && contactId && mapping.pipeline_id && mapping.stage_id) {
      await supabase.from("crm_deals").insert({
        contact_id: contactId,
        pipeline_id: mapping.pipeline_id,
        stage_id: mapping.stage_id,
        title: `ליד מ-${mapping.name}`,
        product_id: mapping.product_id || null,
        status: "open",
        probability: 10,
      });
    }

    // Enqueue automation event
    if (contactId) {
      await supabase.from("crm_automation_queue").insert({
        event_type: "contact.created",
        record_type: "contacts",
        record_id: contactId,
        new_data: contactData,
      });
    }

    console.log(`[Fillout Webhook] Created contact ${contactId} from form ${formId}`);
    res.json({ success: true, contactId });
  } catch (err: any) {
    console.error("[Fillout Webhook] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Generic Incoming Webhook ──
webhookRouter.post("/incoming/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const { data: webhook } = await supabase
      .from("crm_webhooks")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    // Log the webhook
    await supabase.from("crm_webhook_logs").insert({
      webhook_id: webhook.id,
      payload: req.body,
      headers: req.headers as any,
      status: "processed",
    });

    // Update last received
    await supabase
      .from("crm_webhooks")
      .update({ last_received_at: new Date().toISOString() })
      .eq("id", webhook.id);

    // Enqueue automation event
    await supabase.from("crm_automation_queue").insert({
      event_type: "webhook.received",
      record_type: "webhooks",
      record_id: webhook.id,
      new_data: req.body,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Webhook] Error:", err);
    res.status(500).json({ error: err.message });
  }
});
