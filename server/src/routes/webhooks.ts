import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const webhookRouter = Router();

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
      const contactData = {
        tenant_id: tenantId,
        first_name: payload.first_name || "",
        last_name: payload.last_name || "",
        email: payload.email || null,
        phone: payload.phone || null,
        whatsapp_phone: payload.whatsapp_phone || null,
        company: payload.company || null,
        source: payload.source || "manual",
        status: "new" as const,
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
    const contactData: Record<string, any> = {
      tenant_id: tenantId,
      source: "website",
      status: "new",
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

    // Auto-create deal if configured
    if (mapping.auto_create_deal && mapping.pipeline_id && mapping.stage_id) {
      await supabase.from("crm_deals").insert({
        tenant_id: tenantId,
        contact_id: contactId,
        pipeline_id: mapping.pipeline_id,
        stage_id: mapping.stage_id,
        product_id: mapping.product_id,
        title: `${contactData.first_name || ""} ${contactData.last_name || ""} - ${mapping.name}`.trim(),
        value: 0,
        currency: "ILS",
        status: "open",
        stage_entered_at: new Date().toISOString(),
      });
    }

    res.json({ ok: true, contactId });
  } catch (err: any) {
    console.error("Fillout webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});
