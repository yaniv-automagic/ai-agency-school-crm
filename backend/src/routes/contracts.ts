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

    // Send emails (fire-and-forget)
    sendSignedCopyToSigner(contract.title, signerName, signerEmail, publicUrl?.publicUrl || "").catch(console.error);
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
    const body = email_body
      ? `<div dir="rtl" style="font-family: sans-serif;">${email_body}<br><br><a href="${signUrl}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">לחתימה על החוזה</a></div>`
      : buildSigningInvitationEmail(contact.first_name, contract.title, signUrl);

    await sendEmail(contact.email, subject, body);
    await logAuditEvent(contract.id, "email_sent_to_signer", "system", contact.email, null, null);

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

// ── Email Templates ──

function buildSigningInvitationEmail(firstName: string, contractTitle: string, signUrl: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; direction: rtl; padding: 40px 20px; background: #f5f5f5;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 20px; color: #111; margin-bottom: 8px;">שלום ${firstName},</h1>
    <p style="color: #555; line-height: 1.7; margin-bottom: 24px;">
      חוזה <strong>"${contractTitle}"</strong> מוכן לחתימתך.
      <br>לחצ/י על הכפתור למטה כדי לסקור ולחתום על החוזה באופן מאובטח.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${signUrl}" style="display: inline-block; padding: 14px 40px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        לחתימה על החוזה
      </a>
    </div>
    <p style="color: #999; font-size: 13px; margin-top: 24px;">
      החתימה מתבצעת באופן אלקטרוני מאובטח בהתאם לחוק חתימה אלקטרונית, תשס"א-2001.
    </p>
  </div>
</body>
</html>`;
}

async function sendSignedCopyToSigner(contractTitle: string, signerName: string, signerEmail: string, pdfUrl: string) {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; direction: rtl; padding: 40px 20px; background: #f5f5f5;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 60px; height: 60px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">✓</span>
      </div>
    </div>
    <h1 style="font-size: 20px; color: #111; text-align: center; margin-bottom: 8px;">החוזה נחתם בהצלחה</h1>
    <p style="color: #555; line-height: 1.7; margin-bottom: 24px; text-align: center;">
      שלום ${signerName},<br>
      חוזה <strong>"${contractTitle}"</strong> נחתם בהצלחה.
      ${pdfUrl ? '<br>ניתן להוריד את העותק החתום בקישור למטה.' : ''}
    </p>
    ${pdfUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${pdfUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        הורדת חוזה חתום
      </a>
    </div>` : ''}
  </div>
</body>
</html>`;

  await sendEmail(signerEmail, `העתק חוזה חתום - ${contractTitle}`, html);
}

async function sendSigningNotificationToOwner(contract: any, signerName: string, contact: any) {
  if (!contract.created_by) return;

  // Get owner email
  const { data: owner } = await supabase
    .from("crm_team_members")
    .select("email")
    .eq("id", contract.created_by)
    .single();

  if (!owner?.email) return;

  const contractUrl = `${APP_URL}/contracts/${contract.id}`;
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; direction: rtl; padding: 40px 20px; background: #f5f5f5;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 20px; color: #111; margin-bottom: 16px;">חוזה נחתם!</h1>
    <p style="color: #555; line-height: 1.7;">
      <strong>${signerName}</strong> חתם/ה על החוזה <strong>"${contract.title}"</strong>.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${contractUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        צפייה בחוזה
      </a>
    </div>
  </div>
</body>
</html>`;

  await sendEmail(owner.email, `חוזה נחתם - ${contract.title} - ${signerName}`, html);
  await logAuditEvent(contract.id, "email_sent_to_owner", "system", owner.email, null, null);
}
