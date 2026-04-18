import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

export const formRouter = Router();

// ── Public: submit form ──
formRouter.post("/submit/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const submission = req.body;

    // Find form by slug
    const { data: form, error } = await supabase
      .from("crm_forms")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !form) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Map form fields to contact fields
    const contactData: Record<string, any> = {
      tenant_id: form.tenant_id,
      source: "website",
      status: "new",
      tags: [form.source_tag || `form:${slug}`],
      custom_fields: {},
    };

    for (const field of form.fields || []) {
      const value = submission[field.id] || submission[field.label];
      if (!value) continue;

      if (field.mapTo) {
        contactData[field.mapTo] = value;
      } else {
        contactData.custom_fields[field.label] = value;
      }
    }

    // Add UTM data if provided
    const utmFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    for (const utm of utmFields) {
      if (submission[utm]) {
        contactData[utm] = submission[utm];
      }
    }

    if (submission.landing_page_url) contactData.landing_page_url = submission.landing_page_url;
    if (submission.referrer_url) contactData.referrer_url = submission.referrer_url;

    // Check if contact exists by email or phone
    let existingContact = null;
    if (contactData.email) {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("tenant_id", form.tenant_id)
        .eq("email", contactData.email)
        .limit(1)
        .single();
      existingContact = data;
    }

    if (!existingContact && contactData.phone) {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("tenant_id", form.tenant_id)
        .eq("phone", contactData.phone)
        .limit(1)
        .single();
      existingContact = data;
    }

    let contactId: string;

    if (existingContact) {
      // Update existing contact
      await supabase
        .from("crm_contacts")
        .update({
          ...contactData,
          tenant_id: undefined, // Don't update tenant_id
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", existingContact.id);
      contactId = existingContact.id;
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from("crm_contacts")
        .insert(contactData)
        .select("id")
        .single();

      if (insertError) throw insertError;
      contactId = newContact!.id;
    }

    // Create activity
    await supabase.from("crm_activities").insert({
      tenant_id: form.tenant_id,
      contact_id: contactId,
      type: "system",
      direction: "inbound",
      subject: `טופס "${form.name}" מולא`,
      body: JSON.stringify(submission),
      metadata: { form_id: form.id, form_slug: slug },
      performed_at: new Date().toISOString(),
    });

    // Create deal if configured
    if (form.pipeline_id) {
      // Get first stage
      const { data: stage } = await supabase
        .from("crm_pipeline_stages")
        .select("id")
        .eq("pipeline_id", form.pipeline_id)
        .order("order_index", { ascending: true })
        .limit(1)
        .single();

      if (stage) {
        await supabase.from("crm_deals").insert({
          tenant_id: form.tenant_id,
          contact_id: contactId,
          pipeline_id: form.pipeline_id,
          stage_id: stage.id,
          title: `${contactData.first_name || ""} ${contactData.last_name || ""} - ${form.name}`.trim(),
          value: 0,
          currency: "ILS",
          status: "open",
          stage_entered_at: new Date().toISOString(),
        });
      }
    }

    // Increment submission count
    await supabase.rpc("increment_form_submissions", { form_id: form.id });

    res.json({ ok: true, contactId });
  } catch (err: any) {
    console.error("Form submission error:", err);
    res.status(500).json({ error: "Submission failed" });
  }
});

// ── Public: get form config for rendering ──
formRouter.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { data: form, error } = await supabase
      .from("crm_forms")
      .select("name, slug, fields, settings")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !form) {
      return res.status(404).json({ error: "Form not found" });
    }

    res.json(form);
  } catch (err) {
    res.status(500).json({ error: "Failed to load form" });
  }
});
