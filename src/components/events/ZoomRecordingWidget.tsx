import { useState, useEffect } from "react";
import { Video, Download, ExternalLink, Lock, Copy, Check, FileText, Music, AlignLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface RecordingFile {
  file_type: string;          // MP4, M4A, TIMELINE, TRANSCRIPT, CHAT, CC
  file_size: number;
  recording_type: string;     // shared_screen_with_speaker_view, audio_only, etc.
  recording_start: string;
  recording_end: string;
  play_url?: string;
  status?: string;
}

interface Props {
  eventId: string;
  hasRecording: boolean;
  recordingShareUrl: string | null;
  recordingPassword: string | null;
}

const FILE_TYPE_LABEL: Record<string, string> = {
  MP4: "וידאו",
  M4A: "אודיו",
  CHAT: "צ׳אט",
  TRANSCRIPT: "תמלול",
  CC: "כתוביות",
  TIMELINE: "טיימליין",
};

const FILE_TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  MP4: Video,
  M4A: Music,
  CHAT: AlignLeft,
  TRANSCRIPT: FileText,
  CC: FileText,
  TIMELINE: AlignLeft,
};

function formatBytes(b: number): string {
  if (!b) return "—";
  const mb = b / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDuration(start: string, end: string): string {
  const ms = +new Date(end) - +new Date(start);
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}h` : `${m}m`;
}

export function ZoomRecordingWidget({ eventId, hasRecording, recordingShareUrl, recordingPassword }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<RecordingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasRecording) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("not authenticated");
        const apiBase = import.meta.env.VITE_BACKEND_URL || "";

        // List files (no token in response, just metadata)
        const filesRes = await fetch(`${apiBase}/api/zoom/recording/${eventId}/files`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!filesRes.ok) throw new Error(`files: ${filesRes.status}`);
        const filesData = await filesRes.json();
        if (!cancelled) setFiles(filesData.files || []);

        // Get a signed playback URL for the primary MP4
        const playRes = await fetch(`${apiBase}/api/zoom/recording/${eventId}/play?fileType=MP4`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (playRes.ok) {
          const playData = await playRes.json();
          if (!cancelled) setVideoUrl(playData.url);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, hasRecording]);

  async function downloadFile(fileType: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("not authenticated");
      const apiBase = import.meta.env.VITE_BACKEND_URL || "";
      const res = await fetch(`${apiBase}/api/zoom/recording/${eventId}/play?fileType=${fileType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`download: ${res.status}`);
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהורדה");
    }
  }

  function copyPassword() {
    if (!recordingPassword) return;
    navigator.clipboard.writeText(recordingPassword);
    setCopied(true);
    toast.success("הסיסמה הועתקה");
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Video player */}
      <div className="relative bg-black">
        {hasRecording && videoUrl ? (
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full max-h-[480px] object-contain bg-black"
            playsInline
          />
        ) : (
          <div className="bg-muted/30 aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video size={36} className="opacity-30" />
            {loading ? (
              <p className="text-sm">טוען הקלטה...</p>
            ) : hasRecording ? (
              <p className="text-sm">{error || "מנסה להציג הקלטה..."}</p>
            ) : (
              <p className="text-sm">אין הקלטה זמינה</p>
            )}
          </div>
        )}
      </div>

      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-blue-50/50 border-t border-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-blue-500" />
          <span className="text-xs font-medium text-blue-700">הקלטת אירוע</span>
          {hasRecording && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">Zoom</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {recordingPassword && (
            <button
              onClick={copyPassword}
              className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline"
              title="לחץ להעתקה"
            >
              <Lock size={11} />
              סיסמה: <span dir="ltr" className="font-mono">{recordingPassword}</span>
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
          {recordingShareUrl && (
            <a href={recordingShareUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
              <ExternalLink size={11} /> פתח ב-Zoom
            </a>
          )}
        </div>
      </div>

      {/* Files list */}
      {files.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-muted/20">
          <div className="text-[11px] font-medium text-muted-foreground mb-2">קבצי הקלטה</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {files.map((f, i) => {
              const Icon = FILE_TYPE_ICON[f.file_type] || FileText;
              return (
                <button
                  key={i}
                  onClick={() => downloadFile(f.file_type)}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-xs text-right transition-colors"
                  title={f.recording_type}
                >
                  <Download size={12} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{FILE_TYPE_LABEL[f.file_type] || f.file_type}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatBytes(f.file_size)} · {formatDuration(f.recording_start, f.recording_end)}
                    </div>
                  </div>
                  <Icon size={12} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
