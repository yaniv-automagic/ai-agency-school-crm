import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export const integrationRouter = Router();

// ── Save integration config (securely on server) ──
integrationRouter.post("/config", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, provider, config } = req.body;

    const { error } = await supabase.from("crm_integration_configs").upsert(
      {
        tenant_id: tenantId,
        provider,
        config,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" }
    );

    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get integration config (masked for frontend) ──
integrationRouter.get("/config/:provider", authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    const { provider } = req.params;

    const { data, error } = await supabase
      .from("crm_integration_configs")
      .select("config, is_active")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .single();

    if (error || !data) {
      return res.json({ config: {}, is_active: false });
    }

    // Mask sensitive fields
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.config as Record<string, string>)) {
      if (key.includes("key") || key.includes("secret")) {
        masked[key] = value ? `****${value.slice(-4)}` : "";
      } else {
        masked[key] = value;
      }
    }

    res.json({ config: masked, is_active: data.is_active });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test integration connection ──
integrationRouter.post("/test", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, provider } = req.body;

    const { data } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .single();

    if (!data?.config) {
      return res.status(400).json({ error: "Integration not configured" });
    }

    if (provider === "email") {
      const { Resend } = await import("resend");
      const resend = new Resend(data.config["api-key"]);
      await resend.domains.list();
      return res.json({ ok: true, message: "Resend connection successful" });
    }

    if (provider === "whatsapp") {
      const response = await fetch(
        `${data.config["api-url"]}/instance/connectionState/${data.config["api-instance"]}`,
        { headers: { apikey: data.config["api-key"] } }
      );
      const result = await response.json();
      return res.json({ ok: true, state: result });
    }

    res.json({ ok: true, message: "Config saved" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
