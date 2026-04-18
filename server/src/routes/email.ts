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
      subject: "בדיקת חיבור Resend - CRM",
      html: `
        <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
          <h2>✅ החיבור ל-Resend עובד!</h2>
          <p>המייל הזה נשלח מה-CRM שלך כבדיקת חיבור.</p>
          <p style="color: #888; font-size: 12px;">נשלח ב-${new Date().toLocaleString("he-IL")}</p>
        </div>
      `,
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
