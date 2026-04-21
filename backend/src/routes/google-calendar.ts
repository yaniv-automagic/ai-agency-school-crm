import { Router, Request, Response } from "express";
import { google } from "googleapis";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export const googleCalendarRouter = Router();

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google OAuth environment variables");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── Generate Google OAuth URL ──
googleCalendarRouter.get("/auth-url", authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    const oauth2Client = getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: tenantId,
    });

    res.json({ url: authUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── OAuth Callback — exchange code for tokens ──
googleCalendarRouter.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state: tenantId } = req.query;

    if (!code || !tenantId) {
      return res.status(400).json({ error: "Missing code or state" });
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);

    // Get user info for display
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const calendarList = await calendar.calendarList.list({ maxResults: 1 });
    const primaryCalendar = calendarList.data.items?.find(c => c.primary);
    const email = primaryCalendar?.id || "";

    // Save tokens to Supabase
    await supabase.from("crm_integration_configs").upsert(
      {
        tenant_id: tenantId as string,
        provider: "google-calendar",
        config: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type,
          scope: tokens.scope,
          email,
        },
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" }
    );

    // Redirect back to frontend integrations page with success
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/settings/integrations?gcal=connected`);
  } catch (err: any) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/settings/integrations?gcal=error&message=${encodeURIComponent(err.message)}`);
  }
});

// ── Check connection status ──
googleCalendarRouter.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    const { data } = await supabase
      .from("crm_integration_configs")
      .select("config, is_active")
      .eq("tenant_id", tenantId)
      .eq("provider", "google-calendar")
      .single();

    if (data?.is_active) {
      res.json({ connected: true, email: data.config?.email || "" });
    } else {
      res.json({ connected: false });
    }
  } catch {
    res.json({ connected: false });
  }
});

// ── Disconnect ──
googleCalendarRouter.post("/disconnect", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    // Get current tokens to revoke
    const { data } = await supabase
      .from("crm_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("provider", "google-calendar")
      .single();

    if (data?.config?.access_token) {
      try {
        const oauth2Client = getOAuth2Client();
        await oauth2Client.revokeToken(data.config.access_token);
      } catch {
        // Token may already be expired/revoked
      }
    }

    await supabase
      .from("crm_integration_configs")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", "google-calendar");

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
