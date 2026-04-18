import { supabase } from "./supabase.js";

interface EvoConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

export async function getEvoConfig(tenantId: string): Promise<EvoConfig> {
  const { data } = await supabase
    .from("crm_integration_configs")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("provider", "whatsapp")
    .single();

  if (!data?.config) {
    throw new Error("WhatsApp integration not configured");
  }

  return {
    baseUrl: data.config["api-url"] || "",
    apiKey: data.config["api-key"] || "",
    instance: data.config["api-instance"] || "crm-whatsapp",
  };
}

export async function evoFetch(config: EvoConfig, endpoint: string, options?: RequestInit) {
  const url = `${config.baseUrl}/${endpoint}`.replace("{instance}", config.instance);

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API error: ${res.status} ${text}`);
  }

  return res.json();
}
