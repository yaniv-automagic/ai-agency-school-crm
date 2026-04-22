import { Router, Request, Response } from "express";
import { google } from "googleapis";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export const googleCalendarRouter = Router();

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
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
      state: tenantId, // Pass tenantId through OAuth state
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

    if (!data?.config || !data.config.access_token) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      email: data.config.email || "",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Calendar name mapping by meeting type ──
const CALENDAR_NAMES: Record<string, string> = {
  sales_consultation: 'לו"ז מכירות',
  mentoring_1on1: 'לו"ז שירות',
  mastermind_group: 'לו"ז שירות',
};

async function findCalendarByName(calendar: any, name: string): Promise<string | null> {
  const { data: list } = await calendar.calendarList.list();
  const found = list.items?.find((c: any) => c.summary === name);
  return found?.id || null;
}

async function getAuthenticatedCalendar(tenantId: string) {
  const { data } = await supabase
    .from("crm_integration_configs")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("provider", "google-calendar")
    .single();

  if (!data?.config?.access_token) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: data.config.access_token,
    refresh_token: data.config.refresh_token,
    expiry_date: data.config.expiry_date,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    const updated = { ...data.config, ...tokens };
    await supabase.from("crm_integration_configs").update({
      config: updated,
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", tenantId).eq("provider", "google-calendar");
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

// ── Create Google Calendar event for a meeting ──
googleCalendarRouter.post("/events", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, meetingId } = req.body;
    if (!tenantId || !meetingId) {
      return res.status(400).json({ error: "Missing tenantId or meetingId" });
    }

    const calendar = await getAuthenticatedCalendar(tenantId);
    if (!calendar) {
      return res.status(400).json({ error: "Google Calendar לא מחובר" });
    }

    // Fetch meeting with contact
    const { data: meeting } = await supabase
      .from("crm_meetings")
      .select("*, contact:crm_contacts(first_name, last_name, email, phone)")
      .eq("id", meetingId)
      .single();

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Find target calendar
    const calendarName = CALENDAR_NAMES[meeting.meeting_type];
    let calendarId = "primary";
    if (calendarName) {
      const found = await findCalendarByName(calendar, calendarName);
      if (found) calendarId = found;
    }

    // Build attendees
    const attendees: any[] = [];
    if (meeting.contact?.email) {
      attendees.push({ email: meeting.contact.email, displayName: `${meeting.contact.first_name} ${meeting.contact.last_name}` });
    }

    const startTime = new Date(meeting.scheduled_at);
    const endTime = new Date(startTime.getTime() + (meeting.duration_minutes || 60) * 60000);

    const event: any = {
      summary: meeting.title,
      description: meeting.description || "",
      start: { dateTime: startTime.toISOString(), timeZone: "Asia/Jerusalem" },
      end: { dateTime: endTime.toISOString(), timeZone: "Asia/Jerusalem" },
      attendees,
      sendUpdates: "all",
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    };

    if (meeting.meeting_url && meeting.meeting_url !== "auto_generate") {
      event.location = meeting.meeting_url;
    }

    const { data: created } = await calendar.events.insert({
      calendarId,
      requestBody: event,
      sendUpdates: "all",
    });

    // Save google_event_id back to meeting
    await supabase.from("crm_meetings").update({
      google_event_id: `${calendarId}::${created.id}`,
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    res.json({ ok: true, eventId: created.id, calendarId });
  } catch (err: any) {
    console.error("Google Calendar create event error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update Google Calendar event ──
googleCalendarRouter.put("/events", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, meetingId } = req.body;
    if (!tenantId || !meetingId) {
      return res.status(400).json({ error: "Missing tenantId or meetingId" });
    }

    const cal = await getAuthenticatedCalendar(tenantId);
    if (!cal) {
      return res.status(400).json({ error: "Google Calendar לא מחובר" });
    }

    const { data: meeting } = await supabase
      .from("crm_meetings")
      .select("*, contact:crm_contacts(first_name, last_name, email)")
      .eq("id", meetingId)
      .single();

    if (!meeting?.google_event_id) {
      return res.status(404).json({ error: "No linked Google event" });
    }

    // Parse calendarId::eventId
    const [calendarId, eventId] = meeting.google_event_id.includes("::")
      ? meeting.google_event_id.split("::")
      : ["primary", meeting.google_event_id];

    const startTime = new Date(meeting.scheduled_at);
    const endTime = new Date(startTime.getTime() + (meeting.duration_minutes || 60) * 60000);

    const attendees: any[] = [];
    if (meeting.contact?.email) {
      attendees.push({ email: meeting.contact.email, displayName: `${meeting.contact.first_name} ${meeting.contact.last_name}` });
    }

    // Map CRM status to Google event status
    const statusMap: Record<string, string> = {
      scheduled: "confirmed",
      confirmed: "confirmed",
      cancelled: "cancelled",
      rescheduled: "tentative",
      completed: "confirmed",
      no_show: "confirmed",
    };

    const event: any = {
      summary: meeting.title,
      description: meeting.description || "",
      start: { dateTime: startTime.toISOString(), timeZone: "Asia/Jerusalem" },
      end: { dateTime: endTime.toISOString(), timeZone: "Asia/Jerusalem" },
      attendees,
      status: statusMap[meeting.status] || "confirmed",
    };

    if (meeting.meeting_url && meeting.meeting_url !== "auto_generate") {
      event.location = meeting.meeting_url;
    }

    await cal.events.update({
      calendarId,
      eventId,
      requestBody: event,
      sendUpdates: "all",
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Google Calendar update event error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Disconnect Google Calendar ──
googleCalendarRouter.post("/disconnect", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: "Missing tenantId" });
    }

    // Revoke token if possible
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
        // Token revocation may fail if already expired — that's OK
      }
    }

    await supabase
      .from("crm_integration_configs")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", "google-calendar");

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
