/**
 * Evolution API client - proxied through backend.
 * All requests go through the backend server which holds API keys securely.
 * Each user connects their own WhatsApp instance.
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

async function apiFetch(endpoint: string, options?: RequestInit) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/whatsapp${endpoint}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ── Instance Management ──

export interface WhatsAppInstance {
  id: string;
  instance_name: string;
  instance_display_name: string;
  phone_number: string | null;
  status: "disconnected" | "connecting" | "connected" | "banned";
  profile_picture_url: string | null;
  is_default: boolean;
  last_connected_at: string | null;
  created_at: string;
}

export async function createInstance(displayName?: string): Promise<WhatsAppInstance> {
  return apiFetch("/instances", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
}

export async function listInstances(): Promise<WhatsAppInstance[]> {
  return apiFetch("/instances");
}

export async function listTeamInstances(): Promise<any[]> {
  return apiFetch("/instances/team");
}

export async function deleteInstance(instanceId: string): Promise<void> {
  await apiFetch(`/instances/${instanceId}`, { method: "DELETE" });
}

// ── Connection ──

export interface ConnectionState {
  instance: string;
  state: "open" | "close" | "connecting";
}

export interface QRData {
  pairingCode: string | null;
  code: string;
  base64: string;
  count: number;
}

export async function getConnectionStatus(instanceId: string): Promise<{ status: string; raw: any }> {
  return apiFetch(`/instances/${instanceId}/status`);
}

export async function getQRCode(instanceId: string): Promise<QRData> {
  return apiFetch(`/instances/${instanceId}/qr`);
}

export async function disconnectInstance(instanceId: string): Promise<void> {
  await apiFetch(`/instances/${instanceId}/disconnect`, { method: "POST" });
}

// ── Messaging ──

export async function sendTextMessage(phone: string, text: string, instanceId?: string) {
  return apiFetch("/send", {
    method: "POST",
    body: JSON.stringify({ phone, text, instanceId }),
  });
}

export async function sendMedia(phone: string, file: File, caption?: string, instanceId?: string) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      apiFetch("/send-media", {
        method: "POST",
        body: JSON.stringify({
          phone,
          media: base64,
          mimetype: file.type,
          fileName: file.name,
          caption: caption || "",
          instanceId,
        }),
      }).then(resolve).catch(reject);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function findMessages(remoteJid: string, limit = 50, instanceId?: string) {
  return apiFetch("/messages", {
    method: "POST",
    body: JSON.stringify({ remoteJid, limit, instanceId }),
  });
}

export async function fetchProfilePicture(phone: string, instanceId?: string): Promise<string | null> {
  try {
    const data = await apiFetch("/profile-picture", {
      method: "POST",
      body: JSON.stringify({ phone, instanceId }),
    });
    return data?.url || null;
  } catch {
    return null;
  }
}

// ── Helpers ──

export function phoneToJid(phone: string): string {
  let clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("0")) clean = "972" + clean.slice(1);
  return `${clean}@s.whatsapp.net`;
}

export function formatPhoneForApi(phone: string): string {
  let clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("0")) clean = "972" + clean.slice(1);
  return clean;
}
