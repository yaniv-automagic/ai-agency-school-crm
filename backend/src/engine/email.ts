/**
 * Email sending via Resend API.
 * Falls back to logging if RESEND_API_KEY is not set.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "crm@example.com";

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[Email] (No API key) Would send to: ${to}, subject: ${subject}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${res.status} ${error}`);
  }

  console.log(`[Email] Sent to ${to}: "${subject}"`);
}
