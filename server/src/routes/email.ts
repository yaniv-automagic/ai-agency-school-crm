import { Router, Request, Response } from "express";
import { Resend } from "resend";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export const emailRouter = Router();

// ── Send a single email ──
emailRouter.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, to, subject, html, contactId, dealId } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields: to, subject, html" });
    }

    // Get Resend config for this tenant
    const { data: config } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "email")
      .single();

    if (!config?.config?.["api-key"]) {
      return res.status(400).json({ error: "Resend לא מוגדר. הגדר API key בהגדרות > אינטגרציות" });
    }

    const resend = new Resend(config.config["api-key"]);
    const fromEmail = config.config["from-email"] || "noreply@example.com";
    const fromName = config.config["from-name"] || "CRM";

    const { data: emailResult, error: sendError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });

    if (sendError) {
      throw new Error(sendError.message);
    }

    // Log as activity if contactId provided
    if (contactId) {
      await supabase.from("crm_activities").insert({
        tenant_id: tenantId,
        contact_id: contactId,
        deal_id: dealId || null,
        type: "email",
        direction: "outbound",
        subject,
        body: html,
        metadata: { to, resend_id: emailResult?.id, sent_via: "crm" },
      });
    }

    res.json({ ok: true, id: emailResult?.id });
  } catch (err: any) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Send test email ──
emailRouter.post("/test", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, to } = req.body;

    const { data: config } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "email")
      .single();

    if (!config?.config?.["api-key"]) {
      return res.status(400).json({ error: "Resend API key לא מוגדר" });
    }

    const resend = new Resend(config.config["api-key"]);
    const fromEmail = config.config["from-email"] || "noreply@example.com";
    const fromName = config.config["from-name"] || "CRM";

    const { data: emailResult, error: sendError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: to || fromEmail,
      subject: "🚀 בדיקת חיבור Resend - CRM",
      html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0A0820;font-family:'Noto Sans Hebrew',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0820;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:0 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding:12px 24px;background:linear-gradient(90deg,#712FF1,#DC1FFF);border-radius:12px;">
              <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:1px;">AI Agency School</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background-color:#13112B;border-radius:16px;border:1px solid rgba(220,31,255,0.15);">
          <div style="height:3px;background:linear-gradient(90deg,#712FF1,#DC1FFF);"></div>
          <div style="padding:40px 36px;">
            <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#ffffff;">✅ החיבור ל-Resend עובד!</p>
            <p style="margin:0 0 12px;font-size:15px;color:#c8c3d4;line-height:1.8;">המייל הזה נשלח מה-CRM שלך כבדיקת חיבור.</p>
            <p style="margin:0;font-size:12px;color:#6b6480;">נשלח ב-${new Date().toLocaleString("he-IL")}</p>
          </div>
        </td></tr>
        <tr><td style="padding:32px 0 0;" align="center">
          <div style="width:40px;height:2px;background:linear-gradient(90deg,#712FF1,#DC1FFF);border-radius:2px;margin:0 auto 16px;"></div>
          <p style="font-size:12px;color:#6b6480;">AI Agency School<br><a href="https://aiagencyschool.co.il" style="color:#DC1FFF;text-decoration:none;">aiagencyschool.co.il</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (sendError) {
      throw new Error(sendError.message);
    }

    res.json({ ok: true, id: emailResult?.id, message: "מייל בדיקה נשלח בהצלחה" });
  } catch (err: any) {
    console.error("Test email error:", err);
    res.status(500).json({ error: err.message });
  }
});
