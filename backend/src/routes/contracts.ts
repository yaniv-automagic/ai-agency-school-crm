/**
 * Contract Signing API
 * Implements a legally compliant signing ceremony per Israeli Electronic Signature Law.
 * All signing operations go through the backend (not direct Supabase client).
 */

import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../lib/supabase.js";
import { sendEmail } from "../engine/email.js";
import {
  generateContractPdf,
  generateSignedContractPdf,
  computeHash,
  generateCertificateId,
} from "../services/pdf-generator.js";

export const contractRouter = Router();

const CEREMONY_SECRET = process.env.CEREMONY_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "ceremony-fallback-secret";
const APP_URL = process.env.APP_URL || "http://localhost:5173";

// ── Helpers ──

interface CeremonyTokenPayload {
  contract_id: string;
  sign_token: string;
  steps: string[];
}

function createCeremonyToken(payload: CeremonyTokenPayload): string {
  return jwt.sign(payload, CEREMONY_SECRET, { expiresIn: "30m" });
}

function verifyCeremonyToken(token: string): CeremonyTokenPayload | null {
  try {
    return jwt.verify(token, CEREMONY_SECRET) as CeremonyTokenPayload;
  } catch {
    return null;
  }
}

function getClientInfo(req: Request) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket.remoteAddress
    || "";
  const userAgent = req.headers["user-agent"] || "";
  return { ip, userAgent };
}

async function logAuditEvent(
  contractId: string,
  eventType: string,
  actorType: "team_member" | "signer" | "system",
  actorId: string | null,
  ip: string | null,
  userAgent: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("crm_contract_audit_log").insert({
    contract_id: contractId,
    event_type: eventType,
    actor_type: actorType,
    actor_id: actorId,
    ip_address: ip,
    user_agent: userAgent,
    metadata,
  });
}

// ── Public Signing Endpoints ──

/**
 * GET /api/contracts/sign/:token
 * Fetch contract for signing. Updates status to "viewed" if currently "sent".
 */
contractRouter.get("/sign/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { ip, userAgent } = getClientInfo(req);

    const { data: contract, error } = await supabase
      .from("crm_contracts")
      .select("id, title, body_html, status, expires_at, signed_at, contact_id, sign_token, locked, contact:crm_contacts(first_name, last_name, email)")
      .eq("sign_token", token)
      .single();

    if (error || !contract) {
      return res.status(404).json({ error: "חוזה לא נמצא" });
    }

    if (contract.locked || contract.status === "signed") {
      return res.status(400).json({ error: "חוזה כבר נחתם", status: "signed", signed_at: contract.signed_at });
    }

    if (contract.status === "cancelled") {
      return res.status(400).json({ error: "חוזה בוטל" });
    }

    if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
      return res.status(400).json({ error: "פג תוקף החוזה" });
    }

    // Update to viewed
    if (contract.status === "sent") {
      await supabase
        .from("crm_contracts")
        .update({ status: "viewed", viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", contract.id);

      await logAuditEvent(contract.id, "contract_viewed", "signer", null, ip, userAgent);
    }

    // Return only safe fields
    const contact = Array.isArray(contract.contact) ? contract.contact[0] : contract.contact;
    res.json({
      id: contract.id,
      title: contract.title,
      body_html: contract.body_html,
      status: contract.status === "sent" ? "viewed" : contract.status,
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : "",
      contact_email: contact?.email || "",
    });
  } catch (err) {
    console.error("[Contracts] Error fetching contract for signing:", err);
    res.status(500).json({ error: "שגיאת שרת" });
  }
});

/**
 * POST /api/contracts/sign/:token/verify-identity
 * Step 1: Verify signer identity by matching name + email.
 */
contractRouter.post("/sign/:token/verify-identity", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { full_name, email } = req.body;
    const { ip, userAgent } = getClientInfo(req);

    if (!full_name || !email) {
      return res.status(400).json({ error: "שם מלא ואימייל נדרשים" });
    }

    const { data: contract, error } = await supabase
      .from("crm_contracts")
      .select("id, status, locked, contact:crm_contacts(first_name, last_name, email)")
      .eq("sign_token", token)
      .single();

    if (error || !contract) {
      return res.status(404).json({ error: "חוזה לא נמצא" });
    }

    if (contract.locked || contract.status === "signed") {
      return res.status(400).json({ error: "חוזה כבר נחתם" });
    }

    const contact = Array.isArray(contract.contact) ? contract.contact[0] : contract.contact;
    if (!contact) {
      return res.status(400).json({ error: "איש קשר לא נמצא" });
    }

    // Verify identity: compare name and email (case-insensitive)
    const expectedName = `${contact.first_name} ${contact.last_name}`.trim().toLowerCase();
    const providedName = full_name.trim().toLowerCase();
    const emailMatch = email.trim().toLowerCase() === (contact.email || "").trim().toLowerCase();

    if (!emailMatch || providedName !== expectedName) {
      return res.status(400).json({ error: "הפרטים שהוזנו אינם תואמים את פרטי החוזה" });
    }

    // Update contract with confirmed identity
    await supabase
      .from("crm_contracts")
      .update({
        signer_name_confirmed: full_name.trim(),
        signer_email_confirmed: email.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.id);

    await logAuditEvent(contract.id, "identity_verified", "signer", email, ip, userAgent, {
      name: full_name.trim(),
      email: email.trim(),
    });

    // Create ceremony token with step 1 complete
    const ceremonyToken = createCeremonyToken({
      contract_id: contract.id,
      sign_token: token,
      steps: ["identity_verified"],
    });

    res.json({ success: true, ceremony_token: ceremonyToken });
  } catch (err) {
    console.error("[Contracts] Error verifying identity:", err);
    res.status(500).json({ error: "שגיאת שרת" });
  }
});

/**
 * POST /api/contracts/sign/:token/confirm-review
 * Step 2: Confirm the signer has reviewed the document.
 */
contractRouter.post("/sign/:token/confirm-review", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { ceremony_token, time_spent_seconds } = req.body;
    const { ip, userAgent } = getClientInfo(req);

    const payload = verifyCeremonyToken(ceremony_token);
    if (!payload || payload.sign_token !== token || !payload.steps.includes("identity_verified")) {
      return res.status(401).json({ error: "טוקן לא תקף. אנא התחילו את תהליך החתימה מחדש." });
    }

    await supabase
      .from("crm_contracts")
      .update({
        document_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.contract_id);

    await logAuditEvent(payload.contract_id, "document_reviewed", "signer", null, ip, userAgent, {
      time_spent_seconds: time_spent_seconds || 0,
    });

    // Issue updated token with step 2
    const updatedToken = createCeremonyToken({
      ...payload,
      steps: [...payload.steps, "document_reviewed"],
    });

    res.json({ success: true, ceremony_token: updatedToken });
  } catch (err) {
    console.error("[Contracts] Error confirming review:", err);
    res.status(500).json({ error: "שגיאת שרת" });
  }
});

/**
 * POST /api/contracts/sign/:token/consent
 * Step 3: Record the signer's legal consent.
 */
contractRouter.post("/sign/:token/consent", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { ceremony_token, consent_text } = req.body;
    const { ip, userAgent } = getClientInfo(req);

    const payload = verifyCeremonyToken(ceremony_token);
    if (!payload || payload.sign_token !== token || !payload.steps.includes("document_reviewed")) {
      return res.status(401).json({ error: "טוקן לא תקף. אנא התחילו את תהליך החתימה מחדש." });
    }

    await supabase
      .from("crm_contracts")
      .update({
        consent_given_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.contract_id);

    await logAuditEvent(payload.contract_id, "consent_given", "signer", null, ip, userAgent, {
      consent_text: consent_text || "",
    });

    const updatedToken = createCeremonyToken({
      ...payload,
      steps: [...payload.steps, "consent_given"],
    });

    res.json({ success: true, ceremony_token: updatedToken });
  } catch (err) {
    console.error("[Contracts] Error recording consent:", err);
    res.status(500).json({ error: "שגיאת שרת" });
  }
});

/**
 * POST /api/contracts/sign/:token/sign
 * Step 4: Final signature submission. Generates signed PDF, sends emails.
 */
contractRouter.post("/sign/:token/sign", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { ceremony_token, signature_data, signature_type } = req.body;
    const { ip, userAgent } = getClientInfo(req);

    // Validate ceremony token has all required steps
    const payload = verifyCeremonyToken(ceremony_token);
    if (!payload || payload.sign_token !== token) {
      return res.status(401).json({ error: "טוקן לא תקף" });
    }

    const requiredSteps = ["identity_verified", "document_reviewed", "consent_given"];
    const missingSteps = requiredSteps.filter((s) => !payload.steps.includes(s));
    if (missingSteps.length > 0) {
      return res.status(400).json({ error: "לא כל שלבי החתימה הושלמו", missing: missingSteps });
    }

    if (!signature_data || !["drawn", "typed"].includes(signature_type)) {
      return res.status(400).json({ error: "נתוני חתימה לא תקינים" });
    }

    // Fetch contract with contact
    const { data: contract, error } = await supabase
      .from("crm_contracts")
      .select("*, contact:crm_contacts(first_name, last_name, email)")
      .eq("id", payload.contract_id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ error: "חוזה לא נמצא" });
    }

    if (contract.locked || contract.status === "signed") {
      return res.status(400).json({ error: "חוזה כבר נחתם" });
    }

    const contact = Array.isArray(contract.contact) ? contract.contact[0] : contract.contact;
    const signerName = contract.signer_name_confirmed || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
    const signerEmail = contract.signer_email_confirmed || contact?.email || "";
    const signedAt = new Date().toISOString();
    const certificateId = generateCertificateId();

    // Log signature start
    await logAuditEvent(contract.id, "signature_started", "signer", signerEmail, ip, userAgent);

    // Fetch audit trail for certificate
    const { data: auditTrail } = await supabase
      .from("crm_contract_audit_log")
      .select("event_type, created_at, ip_address, actor_type")
      .eq("contract_id", contract.id)
      .order("created_at", { ascending: true });

    // Generate signed PDF
    const signedPdfBuffer = await generateSignedContractPdf({
      title: contract.title,
      bodyHtml: contract.body_html,
      contactName: signerName,
      signatureData: signature_data,
      signatureType: signature_type,
      signerName,
      signerEmail,
      signerIp: ip,
      signedAt,
      certificateId,
      documentHash: contract.document_hash || computeHash(contract.body_html),
      auditTrail: [
        ...(auditTrail || []),
        { event_type: "signature_completed", created_at: signedAt, ip_address: ip, actor_type: "signer" },
      ],
    });

    const signedDocumentHash = computeHash(signedPdfBuffer);

    // Upload signed PDF to Supabase Storage
    const storagePath = `contracts/${contract.id}/signed.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("crm-files")
      .upload(storagePath, signedPdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Contracts] Upload error:", uploadError);
    }

    const { data: publicUrl } = supabase.storage.from("crm-files").getPublicUrl(storagePath);

    // Update contract
    await supabase
      .from("crm_contracts")
      .update({
        status: "signed",
        signature_data,
        signature_type,
        signed_at: signedAt,
        signer_ip: ip,
        signer_user_agent: userAgent,
        signed_pdf_url: publicUrl?.publicUrl || null,
        signed_document_hash: signedDocumentHash,
        certificate_id: certificateId,
        locked: true,
        signing_ceremony_data: {
          steps_completed: [...payload.steps, "signature_completed"],
          completed_at: signedAt,
          ip,
          user_agent: userAgent,
        },
        updated_at: signedAt,
      })
      .eq("id", contract.id);

    // Log completion
    await logAuditEvent(contract.id, "signature_completed", "signer", signerEmail, ip, userAgent, {
      signature_type,
      certificate_id: certificateId,
    });
    await logAuditEvent(contract.id, "signed_pdf_generated", "system", null, null, null, {
      signed_document_hash: signedDocumentHash,
      storage_path: storagePath,
    });

    // Log activity in timeline
    await supabase.from("crm_activities").insert({
      tenant_id: contract.tenant_id,
      contact_id: contract.contact_id,
      deal_id: contract.deal_id || null,
      type: "system",
      subject: `חוזה "${contract.title}" נחתם`,
      body: `${signerName} חתם/ה על החוזה בהצלחה`,
      metadata: {
        contract_id: contract.id,
        certificate_id: certificateId,
        signed_pdf_url: publicUrl?.publicUrl || null,
        event: "contract_signed",
      },
    });

    // Send emails (fire-and-forget)
    sendSignedCopyToSigner(contract.title, signerName, signerEmail, publicUrl?.publicUrl || "", contract.tenant_id).catch(console.error);
    sendSigningNotificationToOwner(contract, signerName, contact).catch(console.error);

    res.json({
      success: true,
      certificate_id: certificateId,
      signed_pdf_url: publicUrl?.publicUrl || null,
      signed_at: signedAt,
    });
  } catch (err) {
    console.error("[Contracts] Error signing contract:", err);
    res.status(500).json({ error: "שגיאת שרת בעת חתימת החוזה" });
  }
});

// ── Authenticated Team Endpoints ──

/**
 * POST /api/contracts/:id/send
 * Send a contract for signing. Generates PDF, computes hash, sends email.
 */
contractRouter.post("/:id/send", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email_subject, email_body, expires_in_days } = req.body;

    const { data: contract, error } = await supabase
      .from("crm_contracts")
      .select("*, contact:crm_contacts(first_name, last_name, email)")
      .eq("id", id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ error: "חוזה לא נמצא" });
    }

    if (contract.locked) {
      return res.status(400).json({ error: "חוזה נעול ולא ניתן לשליחה" });
    }

    const contact = Array.isArray(contract.contact) ? contract.contact[0] : contract.contact;
    if (!contact?.email) {
      return res.status(400).json({ error: "לאיש הקשר אין כתובת אימייל" });
    }

    // Compute document hash
    const documentHash = computeHash(contract.body_html);

    // Generate unsigned PDF
    const pdfBuffer = await generateContractPdf({
      title: contract.title,
      bodyHtml: contract.body_html,
      contactName: `${contact.first_name} ${contact.last_name}`,
    });

    // Upload to storage
    const storagePath = `contracts/${contract.id}/unsigned.pdf`;
    await supabase.storage.from("crm-files").upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    const { data: publicUrl } = supabase.storage.from("crm-files").getPublicUrl(storagePath);

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 30));

    // Ensure sign_token exists
    let signToken = contract.sign_token;
    if (!signToken) {
      signToken = crypto.randomUUID();
    }

    // Update contract
    await supabase
      .from("crm_contracts")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        pdf_url: publicUrl?.publicUrl || null,
        document_hash: documentHash,
        sign_token: signToken,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.id);

    await logAuditEvent(contract.id, "contract_sent", "team_member", null, null, null, {
      document_hash: documentHash,
      expires_at: expiresAt.toISOString(),
    });
    await logAuditEvent(contract.id, "pdf_generated", "system", null, null, null, {
      storage_path: storagePath,
    });

    // Send signing invitation email
    const signUrl = `${APP_URL}/sign/${signToken}`;
    const subject = email_subject || `${contract.title} - חוזה לחתימה`;
    const customContent = email_body
      ? `
    <tr>
      <td class="px-40" style="padding:44px 40px 16px;text-align:right;direction:rtl;">
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:800;color:#0A0820;">
          שלום ${contact.first_name},<br>
          <span style="color:#DC1FFF;">חוזה מוכן לחתימתך</span>
        </h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#555555;">${email_body}</p>
        <div style="text-align:center;margin:8px 0 16px;">
          <a href="${signUrl}" class="cta" style="display:inline-block;background:linear-gradient(180deg,#712FF1 0%,#DC1FFF 100%);color:#FFFFFF;font-size:18px;font-weight:700;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 0 28px rgba(220,31,255,0.45);">
            לחתימה על ההסכם
          </a>
        </div>
        <p style="margin:0;font-size:12px;color:#777777;text-align:center;">חתימה אלקטרונית מאובטחת</p>
      </td>
    </tr>`
      : null;
    const body = customContent
      ? brandedWrapper("light", `${contact.first_name}, חוזה "${contract.title}" מחכה לחתימתך`, customContent)
      : buildSigningInvitationEmail(contact.first_name, contract.title, signUrl);

    await sendEmail(contact.email, subject, body, contract.tenant_id);
    await logAuditEvent(contract.id, "email_sent_to_signer", "system", contact.email, null, null);

    // Log activity in timeline
    await supabase.from("crm_activities").insert({
      tenant_id: contract.tenant_id,
      contact_id: contract.contact_id,
      deal_id: contract.deal_id || null,
      type: "email",
      direction: "outbound",
      subject: subject,
      body: `חוזה "${contract.title}" נשלח לחתימה`,
      metadata: {
        contract_id: contract.id,
        sign_url: signUrl,
        sent_via: "contract",
        expires_at: expiresAt.toISOString(),
      },
    });

    res.json({
      success: true,
      sign_url: signUrl,
      document_hash: documentHash,
      expires_at: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[Contracts] Error sending contract:", err);
    res.status(500).json({ error: "שגיאה בשליחת החוזה" });
  }
});

/**
 * GET /api/contracts/:id/audit-log
 * Get full audit trail for a contract.
 */
contractRouter.get("/:id/audit-log", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("crm_contract_audit_log")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("[Contracts] Error fetching audit log:", err);
    res.status(500).json({ error: "שגיאה בשליפת לוג" });
  }
});

/**
 * POST /api/contracts/:id/generate-pdf
 * Preview PDF generation without sending.
 */
contractRouter.post("/:id/generate-pdf", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: contract, error } = await supabase
      .from("crm_contracts")
      .select("title, body_html, contact:crm_contacts(first_name, last_name)")
      .eq("id", id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ error: "חוזה לא נמצא" });
    }

    const contact = Array.isArray(contract.contact) ? contract.contact[0] : contract.contact;
    const pdfBuffer = await generateContractPdf({
      title: contract.title,
      bodyHtml: contract.body_html,
      contactName: contact ? `${contact.first_name} ${contact.last_name}` : "",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${contract.title}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[Contracts] Error generating PDF:", err);
    res.status(500).json({ error: "שגיאה ביצירת PDF" });
  }
});

// ── Email Templates (branded — AI Agency School design language) ──

const FONT = "'Heebo','Assistant','Noto Sans Hebrew','Segoe UI',Arial,sans-serif";
const LOGO_URL = "https://sqazqjmbnczeargwywxu.supabase.co/storage/v1/render/image/public/crm-files/brand/logo-gold-transparent.png?width=400&quality=90";

function brandedWrapper(variant: "light" | "dark", preheader: string, content: string): string {
  const isDark = variant === "dark";
  const bgOuter = isDark ? "#0A0820" : "#F3F0FA";
  const bgCard = isDark ? "#12082A" : "#FEFBFF";
  const shadow = isDark ? "0 0 32px rgba(220,31,255,0.18)" : "0 10px 40px rgba(75,32,130,0.10)";
  const border = isDark ? "border:1px solid rgba(220,31,255,0.12);" : "";
  const headerBg = isDark ? "#0A0820" : "#FEFBFF";
  const headerBorder = isDark ? "border-bottom:1px solid rgba(220,31,255,0.15);" : "border-bottom:1px solid #E8E6F0;";
  const footerBg = isDark ? "#0A0820" : "#F7F3FF";
  const footerBorder = isDark ? "border-top:1px solid rgba(220,31,255,0.1);" : "border-top:1px solid #E8E6F0;";
  const footerColor = isDark ? "#6E6589" : "#777777";
  const linkColor = isDark ? "#C9A449" : "#712FF1";
  const dotColor = isDark ? "#4B2082" : "#C9C4D9";
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>AI Agency School</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
@media (max-width:620px){
  .container{width:100%!important;}
  .px-40{padding-left:24px!important;padding-right:24px!important;}
  .cta{font-size:16px!important;padding:14px 28px!important;}
  .logo{width:140px!important;height:auto!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${bgOuter};font-family:${FONT};-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${bgOuter};">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgOuter};">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
         style="width:600px;max-width:600px;background:${bgCard};border-radius:20px;overflow:hidden;box-shadow:${shadow};${border}">

    <!-- HEADER -->
    <tr>
      <td style="padding:28px 40px;background:${headerBg};${headerBorder}text-align:center;">
        <img src="${LOGO_URL}" alt="AI Agency School" class="logo" width="200" height="auto" style="display:inline-block;border:0;outline:none;">
      </td>
    </tr>

    <!-- CONTENT -->
    ${content}

    <!-- FOOTER -->
    <tr>
      <td style="padding:28px 40px;background:${footerBg};${footerBorder}text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
          <tr>
            <td style="padding:0 10px;"><a href="https://www.youtube.com/@yaniv.benlolo" style="color:${linkColor};font-size:13px;font-weight:600;">YouTube</a></td>
            <td style="padding:0 10px;color:${dotColor};">·</td>
            <td style="padding:0 10px;"><a href="https://www.instagram.com/nitzan.ai/" style="color:${linkColor};font-size:13px;font-weight:600;">Instagram</a></td>
            <td style="padding:0 10px;color:${dotColor};">·</td>
            <td style="padding:0 10px;"><a href="https://aiagencyschool.co.il" style="color:${linkColor};font-size:13px;font-weight:600;">aiagencyschool.co.il</a></td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${footerColor};direction:rtl;">© ${year} AI Agency School</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

function buildSigningInvitationEmail(firstName: string, contractTitle: string, signUrl: string): string {
  const content = `
    <tr>
      <td class="px-40" style="padding:44px 40px 16px;text-align:right;direction:rtl;">
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:800;color:#0A0820;">
          שלום ${firstName},<br>
          <span style="color:#DC1FFF;">חוזה מוכן לחתימתך</span>
        </h1>
        <p style="margin:0;font-size:16px;line-height:1.65;color:#555555;">
          חוזה <strong>"${contractTitle}"</strong> מוכן לסקירה וחתימה.
        </p>
      </td>
    </tr>

    <tr><td style="padding:0 40px;"><div style="height:1px;background:#E8E6F0;"></div></td></tr>

    <tr>
      <td class="px-40" style="padding:32px 40px;direction:rtl;text-align:right;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F3FF;border-right:4px solid #DC1FFF;border-radius:10px;margin:0 0 24px;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#712FF1;">מה צריך לעשות?</p>
            <p style="margin:0;font-size:15px;color:#333333;line-height:1.6;">לחצ/י על הכפתור למטה, סקור/י את ההסכם וחתום/י באופן מאובטח.</p>
          </td></tr>
        </table>

        <div style="text-align:center;margin:8px 0 32px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
            href="${signUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="100%" stroke="f" fillcolor="#712FF1">
            <w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:18px;font-weight:700;">לחתימה על ההסכם</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${signUrl}" class="cta" style="display:inline-block;background:linear-gradient(180deg,#712FF1 0%,#DC1FFF 100%);color:#FFFFFF;font-size:18px;font-weight:700;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 0 28px rgba(220,31,255,0.45);font-family:${FONT};">
            לחתימה על ההסכם
          </a>
          <!--<![endif]-->
        </div>

        <p style="margin:0;font-size:12px;color:#777777;text-align:center;direction:rtl;">
          החתימה מתבצעת באופן אלקטרוני מאובטח בהתאם לחוק חתימה אלקטרונית, תשס"א-2001.
        </p>
      </td>
    </tr>`;

  return brandedWrapper("light", `${firstName}, חוזה "${contractTitle}" מחכה לחתימתך`, content);
}

async function sendSignedCopyToSigner(contractTitle: string, signerName: string, signerEmail: string, pdfUrl: string, tenantId?: string) {
  const content = `
    <tr>
      <td class="px-40" style="padding:44px 40px 16px;text-align:center;direction:rtl;">
        <div style="width:64px;height:64px;background:rgba(0,208,132,0.12);border-radius:50%;display:inline-block;line-height:64px;margin-bottom:16px;">
          <span style="font-size:28px;color:#00D084;">✓</span>
        </div>
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#0A0820;">
          ההסכם <span style="color:#00D084;">נחתם בהצלחה</span>
        </h1>
        <p style="margin:0;font-size:16px;line-height:1.65;color:#555555;">
          שלום ${signerName},<br>
          חוזה <strong>"${contractTitle}"</strong> נחתם בהצלחה.
          ${pdfUrl ? "<br>ניתן להוריד את העותק החתום בכפתור למטה." : ""}
        </p>
      </td>
    </tr>

    <tr><td style="padding:0 40px;"><div style="height:1px;background:#E8E6F0;"></div></td></tr>

    ${pdfUrl ? `<tr>
      <td class="px-40" style="padding:32px 40px;text-align:center;direction:rtl;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${pdfUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="100%" stroke="f" fillcolor="#712FF1">
          <w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:17px;font-weight:700;">הורדת ההסכם החתום</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${pdfUrl}" class="cta" style="display:inline-block;background:linear-gradient(180deg,#712FF1 0%,#DC1FFF 100%);color:#FFFFFF;font-size:17px;font-weight:700;padding:15px 36px;border-radius:50px;text-decoration:none;box-shadow:0 0 24px rgba(220,31,255,0.35);font-family:${FONT};">
          הורדת ההסכם החתום
        </a>
        <!--<![endif]-->
      </td>
    </tr>` : ""}`;

  const html = brandedWrapper("light", `ההסכם "${contractTitle}" נחתם בהצלחה`, content);
  await sendEmail(signerEmail, `העתק חוזה חתום — ${contractTitle}`, html, tenantId);
}

async function sendSigningNotificationToOwner(contract: any, signerName: string, contact: any) {
  if (!contract.created_by) return;

  const { data: owner } = await supabase
    .from("crm_team_members")
    .select("email")
    .eq("id", contract.created_by)
    .single();

  if (!owner?.email) return;

  const contractUrl = `${APP_URL}/contracts/${contract.id}`;

  const content = `
    <tr>
      <td class="px-40" style="padding:48px 40px 32px;text-align:right;direction:rtl;background:radial-gradient(circle at 15% 0%,rgba(113,47,241,0.35) 0%,transparent 55%);">
        <div style="display:inline-block;background:rgba(0,208,132,0.15);color:#00D084;font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;margin-bottom:16px;">
          חתימה התקבלה ✓
        </div>
        <h1 style="margin:0 0 14px;font-size:28px;line-height:1.25;font-weight:800;color:#FFFFFF;">
          <span style="color:#DC1FFF;">${signerName}</span> חתם/ה על ההסכם
        </h1>
        <p style="margin:0;font-size:16px;line-height:1.6;color:#C9C4D9;">
          חוזה <strong style="color:#FFFFFF;">"${contract.title}"</strong> נחתם בהצלחה.
        </p>
      </td>
    </tr>

    <tr><td style="padding:0 40px;"><div style="height:2px;background:linear-gradient(90deg,transparent 0%,#DC1FFF 50%,transparent 100%);"></div></td></tr>

    <tr>
      <td class="px-40" style="padding:32px 40px;text-align:center;direction:rtl;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${contractUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="100%" stroke="f" fillcolor="#712FF1">
          <w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:17px;font-weight:700;">צפייה בחוזה</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${contractUrl}" class="cta" style="display:inline-block;background:linear-gradient(180deg,#712FF1 0%,#DC1FFF 100%);color:#FFFFFF;font-size:17px;font-weight:700;padding:15px 36px;border-radius:50px;text-decoration:none;box-shadow:0 0 24px rgba(220,31,255,0.35);font-family:${FONT};">
          צפייה בחוזה
        </a>
        <!--<![endif]-->
      </td>
    </tr>`;

  const html = brandedWrapper("dark", `${signerName} חתם/ה על "${contract.title}"`, content);
  await sendEmail(owner.email, `חוזה נחתם — ${contract.title} — ${signerName}`, html, contract.tenant_id);
  await logAuditEvent(contract.id, "email_sent_to_owner", "system", owner.email, null, null);
}
