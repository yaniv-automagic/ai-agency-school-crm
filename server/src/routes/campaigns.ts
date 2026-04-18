import { Router, Request, Response } from "express";
import { Resend } from "resend";
import { supabase } from "../lib/supabase.js";
import { getEvoConfig, evoFetch } from "../lib/evolution.js";
import { authMiddleware } from "../middleware/auth.js";

export const campaignRouter = Router();

// ── Send campaign ──
campaignRouter.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId, tenantId } = req.body;

    // Get campaign
    const { data: campaign, error } = await supabase
      .from("crm_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Get recipients
    const { data: recipients } = await supabase
      .from("crm_campaign_recipients")
      .select("*, contact:crm_contacts(*)")
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (!recipients?.length) {
      return res.status(400).json({ error: "No pending recipients" });
    }

    // Mark campaign as sending
    await supabase
      .from("crm_campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    // Send based on type
    let sentCount = 0;
    let failCount = 0;

    if (campaign.type === "email") {
      sentCount = await sendEmailCampaign(tenantId, campaign, recipients);
    } else if (campaign.type === "whatsapp") {
      const result = await sendWhatsAppCampaign(tenantId, campaign, recipients);
      sentCount = result.sent;
      failCount = result.failed;
    }

    // Update campaign status
    await supabase
      .from("crm_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        stats: {
          sent_count: sentCount,
          failed: failCount,
        },
      })
      .eq("id", campaignId);

    res.json({ sent: sentCount, failed: failCount });
  } catch (err: any) {
    console.error("Campaign send error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function sendEmailCampaign(tenantId: string, campaign: any, recipients: any[]) {
  // Get Resend config
  const { data: config } = await supabase
    .from("crm_integration_configs")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("provider", "email")
    .single();

  if (!config?.config?.["api-key"]) {
    throw new Error("Resend not configured");
  }

  const resend = new Resend(config.config["api-key"]);
  const fromEmail = config.config["from-email"] || "noreply@example.com";
  const fromName = config.config["from-name"] || "CRM";
  let sentCount = 0;

  for (const recipient of recipients) {
    const contact = recipient.contact;
    if (!contact?.email) continue;

    try {
      // Replace variables in body
      const body = replaceVariables(campaign.body_html || campaign.body_text || "", contact);
      const subject = replaceVariables(campaign.subject || "", contact);

      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: contact.email,
        subject,
        html: body,
      });

      await supabase
        .from("crm_campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);

      sentCount++;
    } catch (err) {
      await supabase
        .from("crm_campaign_recipients")
        .update({ status: "failed", error: String(err) })
        .eq("id", recipient.id);
    }
  }

  return sentCount;
}

async function sendWhatsAppCampaign(tenantId: string, campaign: any, recipients: any[]) {
  const config = await getEvoConfig(tenantId);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const contact = recipient.contact;
    const phone = contact?.whatsapp_phone || contact?.phone;
    if (!phone) continue;

    try {
      const text = replaceVariables(campaign.body_text || "", contact);

      await evoFetch(config, `message/sendText/${config.instance}`, {
        method: "POST",
        body: JSON.stringify({ number: phone, text }),
      });

      await supabase
        .from("crm_campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);

      sent++;

      // Rate limit: wait 1s between messages to avoid WhatsApp blocks
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      await supabase
        .from("crm_campaign_recipients")
        .update({ status: "failed", error: String(err) })
        .eq("id", recipient.id);
      failed++;
    }
  }

  return { sent, failed };
}

function replaceVariables(text: string, contact: any): string {
  return text
    .replace(/\{\{first_name\}\}/g, contact.first_name || "")
    .replace(/\{\{last_name\}\}/g, contact.last_name || "")
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{company\}\}/g, contact.company || "");
}
