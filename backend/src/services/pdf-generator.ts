/**
 * PDF Generator Service
 * Uses Puppeteer to generate PDFs from contract HTML with Hebrew RTL support.
 * Generates both unsigned and signed PDFs with signing certificate pages.
 */

import puppeteer, { type Browser } from "puppeteer";
import crypto from "crypto";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

export function computeHash(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function generateCertificateId(): string {
  const short = crypto.randomUUID().split("-")[0].toUpperCase();
  return `CERT-${short}`;
}

interface ContractPdfData {
  title: string;
  bodyHtml: string;
  contactName: string;
}

interface SignedPdfData extends ContractPdfData {
  signatureData: string;
  signatureType: "drawn" | "typed";
  signerName: string;
  signerEmail: string;
  signerIp: string;
  signedAt: string;
  certificateId: string;
  documentHash: string;
  auditTrail: AuditEntry[];
}

interface AuditEntry {
  event_type: string;
  created_at: string;
  ip_address: string | null;
  actor_type: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  contract_created: "חוזה נוצר",
  contract_edited: "חוזה נערך",
  contract_sent: "חוזה נשלח",
  contract_viewed: "חוזה נצפה",
  contract_downloaded: "חוזה הורד",
  identity_verified: "זהות אומתה",
  document_reviewed: "מסמך נקרא",
  consent_given: "הסכמה ניתנה",
  signature_started: "חתימה החלה",
  signature_completed: "חתימה הושלמה",
  pdf_generated: "PDF נוצר",
  signed_pdf_generated: "PDF חתום נוצר",
  email_sent_to_signer: "מייל נשלח לחותם",
  email_sent_to_owner: "מייל נשלח לבעלים",
  contract_expired: "חוזה פג תוקף",
  contract_cancelled: "חוזה בוטל",
};

function wrapHtml(bodyContent: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Heebo', sans-serif;
      direction: rtl;
      text-align: right;
      color: #1a1a1a;
      font-size: 14px;
      line-height: 1.7;
      padding: 40px 50px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 24px; text-align: center; }
    h2 { font-size: 18px; font-weight: 600; margin: 20px 0 12px; }
    h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; }
    p { margin-bottom: 10px; }
    ul, ol { margin: 10px 20px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: right; font-size: 13px; }
    th { background: #f3f4f6; font-weight: 600; }
    .contract-title { text-align: center; margin-bottom: 30px; }
    .contract-title h1 { margin-bottom: 4px; }
    .contract-title .subtitle { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="contract-title">
    <h1>${title}</h1>
  </div>
  ${bodyContent}
</body>
</html>`;
}

function buildSignatureSectionHtml(data: SignedPdfData): string {
  const signedDate = new Date(data.signedAt);
  const formattedDate = signedDate.toLocaleDateString("he-IL", {
    year: "numeric", month: "long", day: "numeric",
  });
  const formattedTime = signedDate.toLocaleTimeString("he-IL", {
    hour: "2-digit", minute: "2-digit",
  });

  const signatureVisual = data.signatureType === "drawn"
    ? `<img src="${data.signatureData}" style="max-width: 300px; max-height: 120px;" />`
    : `<p style="font-family: cursive; font-size: 32px; color: #000;">${data.signatureData}</p>`;

  return `
    <div style="margin-top: 60px; border-top: 2px solid #e5e7eb; padding-top: 24px;">
      <h2 style="margin-bottom: 16px;">חתימה</h2>
      <div style="margin-bottom: 8px;">
        ${signatureVisual}
      </div>
      <p style="font-size: 13px; color: #6b7280;">
        ${data.signerName} | ${formattedDate} בשעה ${formattedTime}
      </p>
    </div>
  `;
}

/**
 * Replace the signature placeholder block in the contract HTML with the
 * actual signature. Matches the pattern the template builder outputs.
 */
function embedSignatureInBody(bodyHtml: string, data: SignedPdfData): string {
  const signatureBlock = data.signatureType === "drawn"
    ? `<div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;background:#fff;">
         <img src="${data.signatureData}" alt="חתימה" style="max-height:120px;max-width:300px;display:inline-block;" />
         <div style="margin-top:8px;font-size:13px;color:#6b7280;">${data.signerName}</div>
       </div>`
    : `<div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;background:#fff;">
         <div style="font-family:cursive;font-size:28px;color:#000;">${data.signatureData}</div>
         <div style="margin-top:8px;font-size:13px;color:#6b7280;">${data.signerName}</div>
       </div>`;

  const placeholderRegex = /<div[^>]*border:2px dashed[^>]*>[^<]*חתימת[^<]*<\/div>/g;
  if (placeholderRegex.test(bodyHtml)) {
    return bodyHtml.replace(placeholderRegex, signatureBlock);
  }
  // Fallback: append at the end if no placeholder in template
  return bodyHtml + buildSignatureSectionHtml(data);
}

function buildCertificatePageHtml(data: SignedPdfData): string {
  const signedDate = new Date(data.signedAt);
  const formattedDateTime = signedDate.toLocaleString("he-IL", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const auditRows = data.auditTrail
    .map((entry) => {
      const eventDate = new Date(entry.created_at);
      const time = eventDate.toLocaleString("he-IL", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      const label = EVENT_TYPE_LABELS[entry.event_type] || entry.event_type;
      return `<tr>
        <td>${time}</td>
        <td>${label}</td>
        <td>${entry.ip_address || "-"}</td>
        <td>${entry.actor_type === "signer" ? "חותם" : entry.actor_type === "team_member" ? "צוות" : "מערכת"}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Heebo', sans-serif;
      direction: rtl;
      text-align: right;
      color: #1a1a1a;
      font-size: 13px;
      line-height: 1.6;
      padding: 40px 50px;
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 24px; text-align: center; }
    .cert-header {
      text-align: center;
      padding: 20px;
      border: 2px solid #2563eb;
      border-radius: 12px;
      margin-bottom: 30px;
      background: #eff6ff;
    }
    .cert-header h1 { color: #1e40af; margin-bottom: 4px; }
    .cert-id { font-size: 16px; color: #3b82f6; font-weight: 600; }
    .field { margin-bottom: 12px; }
    .field-label { font-weight: 600; color: #374151; display: inline; }
    .field-value { display: inline; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: right; }
    th { background: #f3f4f6; font-weight: 600; }
    .legal-note {
      margin-top: 24px;
      padding: 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 11px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="cert-header">
    <h1>תעודת חתימה אלקטרונית</h1>
    <div class="cert-id">${data.certificateId}</div>
  </div>

  <h2 style="font-size: 16px; margin-bottom: 16px;">פרטי החתימה</h2>

  <div class="field"><span class="field-label">שם החותם: </span><span class="field-value">${data.signerName}</span></div>
  <div class="field"><span class="field-label">דוא"ל: </span><span class="field-value">${data.signerEmail}</span></div>
  <div class="field"><span class="field-label">כתובת IP: </span><span class="field-value">${data.signerIp}</span></div>
  <div class="field"><span class="field-label">תאריך ושעה: </span><span class="field-value">${formattedDateTime}</span></div>
  <div class="field"><span class="field-label">סוג חתימה: </span><span class="field-value">${data.signatureType === "drawn" ? "חתימה ידנית (ציור)" : "חתימה מוקלדת"}</span></div>

  <h2 style="font-size: 16px; margin: 24px 0 12px;">שלמות המסמך</h2>
  <div class="field"><span class="field-label">SHA-256 Hash: </span><span class="field-value" style="font-family: monospace; font-size: 11px; word-break: break-all;">${data.documentHash}</span></div>

  <h2 style="font-size: 16px; margin: 24px 0 12px;">מעקב אירועים (Audit Trail)</h2>
  <table>
    <thead>
      <tr>
        <th>תאריך ושעה</th>
        <th>אירוע</th>
        <th>IP</th>
        <th>גורם</th>
      </tr>
    </thead>
    <tbody>
      ${auditRows}
    </tbody>
  </table>

  <div class="legal-note">
    <strong>הצהרה משפטית:</strong> מסמך זה נחתם באופן אלקטרוני בהתאם לחוק חתימה אלקטרונית, תשס"א-2001.
    החותם אימת את זהותו, סקר את המסמך, ונתן הסכמה מפורשת לחתימה אלקטרונית.
    כל הפעולות תועדו עם חותמות זמן וכתובות IP. שלמות המסמך מאומתת באמצעות hash קריפטוגרפי SHA-256.
  </div>
</body>
</html>`;
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const html = wrapHtml(data.bodyHtml, data.title);
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function generateSignedContractPdf(data: SignedPdfData): Promise<Buffer> {
  const browser = await getBrowser();

  // Page 1: Contract with embedded signature (replaces placeholder in body)
  const contractPage = await browser.newPage();
  let contractPdfBuffer: Buffer;
  try {
    const contractHtml = wrapHtml(
      embedSignatureInBody(data.bodyHtml, data),
      data.title,
    );
    await contractPage.setContent(contractHtml, { waitUntil: "networkidle0", timeout: 15000 });
    contractPdfBuffer = Buffer.from(await contractPage.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    }));
  } finally {
    await contractPage.close();
  }

  // Page 2: Signing certificate
  const certPage = await browser.newPage();
  let certPdfBuffer: Buffer;
  try {
    const certHtml = buildCertificatePageHtml(data);
    await certPage.setContent(certHtml, { waitUntil: "networkidle0", timeout: 15000 });
    certPdfBuffer = Buffer.from(await certPage.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    }));
  } finally {
    await certPage.close();
  }

  // Merge: simple concatenation approach using PDFLib would be ideal,
  // but for simplicity we'll generate a single combined HTML page
  const combinedPage = await browser.newPage();
  try {
    const combinedHtml = wrapHtml(
      data.bodyHtml + buildSignatureSectionHtml(data),
      data.title,
    ) + `<div style="page-break-before: always;"></div>` + buildCertificatePageHtml(data);

    // Build a single-page HTML with both sections
    const fullHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Heebo', sans-serif; direction: rtl; text-align: right; color: #1a1a1a; font-size: 14px; line-height: 1.7; }
    .page { padding: 40px 50px; }
    .page-break { page-break-before: always; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 24px; text-align: center; }
    h2 { font-size: 18px; font-weight: 600; margin: 20px 0 12px; }
    p { margin-bottom: 10px; }
    ul, ol { margin: 10px 20px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: right; font-size: 13px; }
    th { background: #f3f4f6; font-weight: 600; }
    .contract-title { text-align: center; margin-bottom: 30px; }
    .cert-header { text-align: center; padding: 20px; border: 2px solid #2563eb; border-radius: 12px; margin-bottom: 30px; background: #eff6ff; }
    .cert-header h1 { color: #1e40af; margin-bottom: 4px; font-size: 20px; }
    .cert-id { font-size: 16px; color: #3b82f6; font-weight: 600; }
    .field { margin-bottom: 12px; font-size: 13px; }
    .field-label { font-weight: 600; color: #374151; }
    .legal-note { margin-top: 24px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 11px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="page">
    <div class="contract-title"><h1>${data.title}</h1></div>
    ${embedSignatureInBody(data.bodyHtml, data)}
  </div>
  <div class="page-break"></div>
  <div class="page">
    <div class="cert-header">
      <h1>תעודת חתימה אלקטרונית</h1>
      <div class="cert-id">${data.certificateId}</div>
    </div>
    <h2 style="font-size: 16px; margin-bottom: 16px;">פרטי החתימה</h2>
    <div class="field"><span class="field-label">שם החותם: </span>${data.signerName}</div>
    <div class="field"><span class="field-label">דוא"ל: </span>${data.signerEmail}</div>
    <div class="field"><span class="field-label">כתובת IP: </span>${data.signerIp}</div>
    <div class="field"><span class="field-label">תאריך ושעה: </span>${new Date(data.signedAt).toLocaleString("he-IL")}</div>
    <div class="field"><span class="field-label">סוג חתימה: </span>${data.signatureType === "drawn" ? "חתימה ידנית (ציור)" : "חתימה מוקלדת"}</div>
    <h2 style="font-size: 16px; margin: 24px 0 12px;">שלמות המסמך</h2>
    <div class="field"><span class="field-label">SHA-256 Hash: </span><span style="font-family: monospace; font-size: 11px; word-break: break-all;">${data.documentHash}</span></div>
    <h2 style="font-size: 16px; margin: 24px 0 12px;">מעקב אירועים (Audit Trail)</h2>
    <table>
      <thead><tr><th>תאריך ושעה</th><th>אירוע</th><th>IP</th><th>גורם</th></tr></thead>
      <tbody>
        ${data.auditTrail.map((e) => {
          const t = new Date(e.created_at).toLocaleString("he-IL");
          const label = EVENT_TYPE_LABELS[e.event_type] || e.event_type;
          const actor = e.actor_type === "signer" ? "חותם" : e.actor_type === "team_member" ? "צוות" : "מערכת";
          return `<tr><td>${t}</td><td>${label}</td><td>${e.ip_address || "-"}</td><td>${actor}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="legal-note">
      <strong>הצהרה משפטית:</strong> מסמך זה נחתם באופן אלקטרוני בהתאם לחוק חתימה אלקטרונית, תשס"א-2001.
      החותם אימת את זהותו, סקר את המסמך, ונתן הסכמה מפורשת לחתימה אלקטרונית.
      כל הפעולות תועדו עם חותמות זמן וכתובות IP. שלמות המסמך מאומתת באמצעות hash קריפטוגרפי SHA-256.
    </div>
  </div>
</body>
</html>`;

    await combinedPage.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 });
    const finalPdf = await combinedPage.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });
    return Buffer.from(finalPdf);
  } finally {
    await combinedPage.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
