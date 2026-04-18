/**
 * Email API client - sends emails via Resend through the backend server.
 */

import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("לא מחובר. יש להתחבר מחדש.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function sendEmail(params: {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  contactId?: string;
  dealId?: string;
}): Promise<{ ok: boolean; id?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/email/send`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `שגיאה בשליחת מייל: ${res.status}`);
  }
  return data;
}

export async function sendTestEmail(tenantId: string, to?: string): Promise<{ ok: boolean; message?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/email/test`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tenantId, to }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `שגיאה בשליחת מייל בדיקה: ${res.status}`);
  }
  return data;
}
