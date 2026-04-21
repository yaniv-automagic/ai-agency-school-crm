/**
 * Email sending via Resend API.
 * Resolves API key from tenant config in DB, falls back to env var.
 */

import { supabase } from "../lib/supabase.js";

const ENV_API_KEY = process.env.RESEND_API_KEY;
const ENV_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "crm@example.com";
const ENV_FROM_NAME = process.env.RESEND_FROM_NAME || "CRM";

// Cache tenant config for 5 minutes to avoid repeated DB queries
let tenantConfigCache: { key: string; from: string; name: string; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getResendConfig(tenantId?: string): Promise<{ apiKey: string; fromEmail: string; fromName: string }> {
  // Try tenant-specific config from DB
  if (tenantId || tenantConfigCache) {
    if (tenantConfigCache && Date.now() - tenantConfigCache.ts < CACHE_TTL) {
      return { apiKey: tenantConfigCache.key, fromEmail: tenantConfigCache.from, fromName: tenantConfigCache.name };
    }

    let q = supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("provider", "email")
      .eq("is_active", true);

    if (tenantId) q = q.eq("tenant_id", tenantId);

    const { data } = await q.limit(1).single();

    if (data?.config?.["api-key"]) {
      tenantConfigCache = {
        key: data.config["api-key"],
        from: data.config["from-email"] || ENV_FROM_EMAIL,
        name: data.config["from-name"] || ENV_FROM_NAME,
        ts: Date.now(),
      };
      return { apiKey: tenantConfigCache.key, fromEmail: tenantConfigCache.from, fromName: tenantConfigCache.name };
    }
  }

  // Fallback to env vars
  return { apiKey: ENV_API_KEY || "", fromEmail: ENV_FROM_EMAIL, fromName: ENV_FROM_NAME };
}

export async function sendEmail(to: string, subject: string, htmlBody: string, tenantId?: string): Promise<void> {
  const { apiKey, fromEmail, fromName } = await getResendConfig(tenantId);

  if (!apiKey) {
    console.log(`[Email] (No API key) Would send to: ${to}, subject: ${subject}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
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
