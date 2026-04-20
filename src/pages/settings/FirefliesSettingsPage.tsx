import { useState, useEffect } from "react";
import { ArrowRight, Video, Key, Check, Loader2, Copy, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const WEBHOOK_BACKEND_URL = import.meta.env.VITE_WEBHOOK_BACKEND_URL || BACKEND_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("לא מחובר. יש להתחבר מחדש.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

export default function FirefliesSettingsPage() {
  const navigate = useNavigate();
  const { teamMember } = useAuth();
  const tenantId = teamMember?.tenant_id;

  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const webhookUrl = tenantId
    ? `${WEBHOOK_BACKEND_URL}/api/webhooks/fireflies/${tenantId}`
    : "";

  // Load existing config
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(
          `${BACKEND_URL}/api/integrations/config/fireflies?tenantId=${tenantId}`,
          { headers }
        );
        const data = await res.json();
        if (data.config?.api_key) {
          setApiKey(data.config.api_key);
          setIsActive(data.is_active);
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, [tenantId]);

  const handleSave = async () => {
    if (!apiKey.trim() || !tenantId) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BACKEND_URL}/api/integrations/config`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tenantId,
          provider: "fireflies",
          config: { api_key: apiKey },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsActive(true);
      toast.success("הגדרות Fireflies נשמרו");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId) return;
    setTesting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BACKEND_URL}/api/integrations/test`, {
        method: "POST",
        headers,
        body: JSON.stringify({ tenantId, provider: "fireflies" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "חיבור תקין!");
    } catch (err: any) {
      toast.error(err.message || "בדיקת חיבור נכשלה");
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL הועתק");
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowRight size={16} />
          חזרה להגדרות
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-500">
            <Video size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fireflies.ai</h1>
            <p className="text-muted-foreground text-sm">
              תמלול והקלטת פגישות אוטומטי — הקלטות ותמלולים מתווספים אוטומטית לטיימליין
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      {isActive && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <Check size={16} className="text-green-600" />
          <span className="text-sm text-green-700 font-medium">Fireflies מחובר ופעיל</span>
        </div>
      )}

      {/* API Key */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Key size={16} className="text-muted-foreground" />
          מפתח API
        </h3>
        <p className="text-sm text-muted-foreground">
          ניתן למצוא את מפתח ה-API ב-
          <a
            href="https://app.fireflies.ai/integrations/custom/fireflies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1 mx-1"
          >
            הגדרות Fireflies
            <ExternalLink size={12} />
          </a>
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="הזן API Key..."
            className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring/50"
            dir="ltr"
          />
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            שמור
          </button>
        </div>
        {isActive && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : null}
            {testing ? "בודק חיבור..." : "בדוק חיבור"}
          </button>
        )}
      </div>

      {/* Webhook URL */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">כתובת Webhook</h3>
        <p className="text-sm text-muted-foreground">
          העתק את הכתובת הזו והגדר אותה ב-Fireflies תחת{" "}
          <strong>Settings → Integrations → Webhooks</strong>
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={webhookUrl}
            readOnly
            className="flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-secondary/50 text-muted-foreground font-mono"
            dir="ltr"
          />
          <button
            onClick={copyWebhookUrl}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            <Copy size={14} />
            העתק
          </button>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">הוראות הגדרה</h3>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0", isActive ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700")}>1</span>
            <span>הזן את מפתח ה-API מחשבון ה-Fireflies שלך ולחץ ״שמור״</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span>
              ב-Fireflies, גש ל-
              <a
                href="https://app.fireflies.ai/integrations/custom/fireflies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 mx-1"
              >
                Webhooks Settings
                <ExternalLink size={12} />
              </a>
              והוסף את כתובת ה-Webhook שלמעלה
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span>בחר את ה-event: <strong>meeting.transcribed</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>ודא שמיילים של אנשי קשר ב-CRM תואמים למשתתפי הפגישות ב-Fireflies</span>
          </li>
        </ol>
      </div>

      {/* How it works */}
      <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-purple-800">איך זה עובד?</h3>
        <ul className="space-y-2 text-sm text-purple-700">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            כשפגישה מסתיימת ו-Fireflies מסיים את התמלול, נשלח webhook אוטומטית
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            המערכת מזהה את המשתתפים לפי מייל ומתאימה לאנשי קשר קיימים
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            הקלטה, תמלול, סיכום AI ופריטי פעולה מתווספים אוטומטית לטיימליין של איש הקשר
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            בנוסף נוצרת רשומת פגישה עם כל המידע בעמוד הפגישות
          </li>
        </ul>
      </div>
    </div>
  );
}
