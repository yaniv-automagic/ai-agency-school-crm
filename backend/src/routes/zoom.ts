import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export const zoomRouter = Router();

interface ZoomConfigRow { config: { account_id: string; client_id: string; client_secret: string; api_base?: string } }

// In-memory token cache. Tokens are valid for 1 hour; refresh ~10 min before expiry.
let cachedToken: { token: string; apiBase: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<{ token: string; apiBase: string }> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { token: cachedToken.token, apiBase: cachedToken.apiBase };
  }

  const { data, error } = await supabase
    .from("crm_integration_configs")
    .select("config")
    .eq("provider", "zoom")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Zoom config: ${error.message}`);
  const cfg = (data as ZoomConfigRow | null)?.config;
  if (!cfg?.account_id || !cfg?.client_id || !cfg?.client_secret) {
    throw new Error("Zoom integration not configured");
  }

  const basic = Buffer.from(`${cfg.client_id}:${cfg.client_secret}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${cfg.account_id}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Zoom OAuth failed: ${res.status}`);
  const body: any = await res.json();
  cachedToken = {
    token: body.access_token,
    apiBase: body.api_url || cfg.api_base || "https://api.zoom.us",
    expiresAt: Date.now() + (body.expires_in - 600) * 1000, // refresh 10 min before expiry
  };
  return { token: cachedToken.token, apiBase: cachedToken.apiBase };
}

// GET /api/zoom/recording/:eventId/play
//   Returns a short-lived signed URL for the event's primary MP4 recording.
//   Frontend uses the URL as <video src> or for download.
//   Query param: fileType=MP4|M4A|TRANSCRIPT|CHAT|TIMELINE|CC  (default MP4)
//                recordingType=shared_screen_with_speaker_view|... (default first MP4)
zoomRouter.get("/recording/:eventId/play", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const fileType = ((req.query.fileType as string) || "MP4").toUpperCase();
    const recordingType = req.query.recordingType as string | undefined;

    const { data: event, error } = await supabase
      .from("crm_events")
      .select("recording_files,external_source")
      .eq("id", eventId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!event) return res.status(404).json({ error: "event not found" });
    if (event.external_source !== "zoom") return res.status(400).json({ error: "event is not from Zoom" });

    const files: any[] = event.recording_files || [];
    if (!files.length) return res.status(404).json({ error: "no recording files" });

    // Pick the file: prefer matching fileType + recordingType, fall back to first matching fileType
    const file = files.find(f => f.file_type === fileType && (!recordingType || f.recording_type === recordingType))
              || files.find(f => f.file_type === fileType && f.recording_type === "shared_screen_with_speaker_view")
              || files.find(f => f.file_type === fileType);
    if (!file) return res.status(404).json({ error: `no file with type=${fileType}` });
    if (!file.download_url) return res.status(404).json({ error: "file has no download_url" });

    const { token } = await getZoomAccessToken();
    const url = `${file.download_url}${file.download_url.includes("?") ? "&" : "?"}access_token=${token}`;
    return res.json({
      url,
      expires_in: cachedToken ? Math.max(60, Math.floor((cachedToken.expiresAt - Date.now()) / 1000)) : 3000,
      file_type: file.file_type,
      file_size: file.file_size,
      recording_type: file.recording_type,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zoom/recording/:eventId/files
//   Returns the list of recording files for an event (without download tokens).
zoomRouter.get("/recording/:eventId/files", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { data: event, error } = await supabase
      .from("crm_events")
      .select("recording_files,recording_password,recording_url")
      .eq("id", eventId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!event) return res.status(404).json({ error: "event not found" });

    const files = (event.recording_files || []).map((f: any) => ({
      file_type: f.file_type,
      file_size: f.file_size,
      recording_type: f.recording_type,
      recording_start: f.recording_start,
      recording_end: f.recording_end,
      play_url: f.play_url,
      status: f.status,
    }));
    res.json({ files, share_url: event.recording_url, password: event.recording_password });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
