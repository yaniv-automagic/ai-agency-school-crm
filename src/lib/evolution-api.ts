/**
 * Evolution API client for WhatsApp integration.
 * All requests go directly to the Evolution API server.
 * Configure via environment variables or settings page.
 */

const getConfig = () => ({
  baseUrl: localStorage.getItem("evo-api-url") || "http://localhost:8081",
  apiKey: localStorage.getItem("evo-api-key") || "",
  instance: localStorage.getItem("evo-api-instance") || "crm-whatsapp",
});

async function evoFetch(endpoint: string, options?: RequestInit) {
  const { baseUrl, apiKey, instance } = getConfig();
  const url = `${baseUrl}/${endpoint}`.replace("{instance}", instance);

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API error: ${res.status} ${text}`);
  }

  return res.json();
}

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

export async function getConnectionState(): Promise<ConnectionState> {
  const data = await evoFetch(`instance/connectionState/${getConfig().instance}`);
  return data.instance || data;
}

export async function getQRCode(): Promise<QRData> {
  const data = await evoFetch(`instance/connect/${getConfig().instance}`);
  return data;
}

export async function sendTextMessage(phone: string, text: string) {
  return evoFetch(`message/sendText/${getConfig().instance}`, {
    method: "POST",
    body: JSON.stringify({ number: phone, text }),
  });
}

export async function sendMedia(phone: string, file: File, caption?: string) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const isImage = file.type.startsWith("image/");
      const endpoint = isImage ? "message/sendImage" : "message/sendDocument";
      evoFetch(`${endpoint}/${getConfig().instance}`, {
        method: "POST",
        body: JSON.stringify({
          number: phone,
          media: base64,
          mimetype: file.type,
          fileName: file.name,
          caption: caption || "",
        }),
      }).then(resolve).catch(reject);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function findMessages(remoteJid: string, limit = 50) {
  return evoFetch(`chat/findMessages/${getConfig().instance}`, {
    method: "POST",
    body: JSON.stringify({ where: { key: { remoteJid } }, limit }),
  });
}

export async function fetchProfilePicture(phone: string): Promise<string | null> {
  try {
    const data = await evoFetch(`chat/fetchProfilePictureUrl/${getConfig().instance}`, {
      method: "POST",
      body: JSON.stringify({ number: phone }),
    });
    return data?.profilePictureUrl || data?.wpiUrl || null;
  } catch {
    return null;
  }
}

export function isConfigured(): boolean {
  const { baseUrl, apiKey } = getConfig();
  return !!baseUrl && !!apiKey;
}
