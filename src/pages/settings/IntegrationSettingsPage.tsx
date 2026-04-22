import { useState, useEffect } from "react";
import { ArrowRight, MessageCircle, Calendar, Webhook, Mail, Key, ExternalLink, Check, Save, Loader2, Send, Unplug } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { sendTestEmail } from "@/lib/email-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  providerId?: string; // provider key for crm_integration_configs
  oauthConnect?: boolean; // true = use OAuth connect button instead of manual fields
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: "whatsapp",
    name: "WhatsApp (Evolution API)",
    description: "חיבור WhatsApp Cloud API דרך Evolution API לשליחת הודעות ישירות מה-CRM",
    icon: MessageCircle,
    color: "text-emerald-500 bg-emerald-50",
    providerId: "whatsapp",
    fields: [
      { key: "api-url", label: "Evolution API URL", placeholder: "http://localhost:8081" },
      { key: "api-key", label: "API Key", type: "password", placeholder: "your-api-key" },
      { key: "api-instance", label: "Instance Name", placeholder: "crm-whatsapp" },
    ],
  },
  {
    id: "email",
    name: "Resend (Email)",
    description: "שליחת מיילים אוטומטיים וקמפיינים דרך Resend API",
    icon: Mail,
    color: "text-blue-500 bg-blue-50",
    providerId: "email",
    fields: [
      { key: "api-key", label: "Resend API Key", type: "password", placeholder: "re_..." },
      { key: "from-email", label: "From Email", placeholder: "crm@yourdomain.com" },
      { key: "from-name", label: "From Name", placeholder: "AI Agency School" },
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "סנכרון פגישות ומשימות עם Google Calendar",
    icon: Calendar,
    color: "text-orange-500 bg-orange-50",
    oauthConnect: true,
    fields: [],
  },
  {
    id: "webhooks",
    name: "Webhooks & API",
    description: "הגדרת webhook endpoints לחיבור עם Zapier, Make ושירותים חיצוניים",
    icon: Webhook,
    color: "text-purple-500 bg-purple-50",
    providerId: "webhooks",
    fields: [
      { key: "api-key", label: "CRM API Key", placeholder: "ייווצר אוטומטית" },
      { key: "webhook-secret", label: "Webhook Secret", type: "password", placeholder: "סוד לאימות webhooks" },
    ],
  },
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export default function IntegrationSettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { teamMember } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; email?: string }>({ connected: false });
  const [gcalLoading, setGcalLoading] = useState(false);

  // Handle Google Calendar OAuth callback params
  useEffect(() => {
    const gcal = searchParams.get("gcal");
    if (gcal === "connected") {
      toast.success("Google Calendar חובר בהצלחה!");
      setExpandedId("google-calendar");
      // Clean URL
      window.history.replaceState({}, "", "/settings/integrations");
    } else if (gcal === "error") {
      toast.error(`שגיאה בחיבור Google Calendar: ${searchParams.get("message") || "Unknown error"}`);
      window.history.replaceState({}, "", "/settings/integrations");
    }
  }, [searchParams]);

  // Check Google Calendar connection status
  useEffect(() => {
    if (!teamMember?.tenant_id) return;
    const checkGcalStatus = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch(
          `${BACKEND_URL}/api/integrations/google-calendar/status?tenantId=${teamMember.tenant_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setGcalStatus(data);
      } catch {
        // Silently fail - just show disconnected state
      }
    };
    checkGcalStatus();
  }, [teamMember?.tenant_id, searchParams]);

  // Load saved values from Supabase
  useEffect(() => {
    if (!teamMember?.tenant_id) return;
    (async () => {
      const { data } = await supabase
        .from("crm_integration_configs")
        .select("provider, config")
        .eq("tenant_id", teamMember.tenant_id);

      const values: Record<string, Record<string, string>> = {};
      for (const integration of INTEGRATIONS) {
        if (integration.oauthConnect) continue;
        const row = data?.find(d => d.provider === integration.id);
        values[integration.id] = {};
        for (const field of integration.fields) {
          values[integration.id][field.key] = row?.config?.[field.key] || "";
        }
      }
      setFormValues(values);
    })();
  }, [teamMember?.tenant_id]);

  const handleSave = async (integrationId: string) => {
    const integration = INTEGRATIONS.find(i => i.id === integrationId)!;
    setSaving(integrationId);

    await supabase.from("crm_integration_configs").upsert({
      tenant_id: teamMember?.tenant_id,
      provider: integrationId,
      config: formValues[integrationId] || {},
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });

    setSaving(null);
    toast.success(`${integration.name} - הגדרות נשמרו`);
  };

  const updateField = (integrationId: string, fieldKey: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [integrationId]: { ...(prev[integrationId] || {}), [fieldKey]: value },
    }));
  };

  const handleTestEmail = async () => {
    setTesting("email");
    try {
      const result = await sendTestEmail(teamMember?.tenant_id || "");
      toast.success(result.message || "מייל בדיקה נשלח בהצלחה!");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשליחת מייל בדיקה");
    } finally {
      setTesting(null);
    }
  };

  const handleGcalConnect = async () => {
    setGcalLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(
        `${BACKEND_URL}/api/integrations/google-calendar/auth-url?tenantId=${teamMember?.tenant_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "שגיאה ביצירת קישור החיבור");
      }
    } catch (err: any) {
      toast.error("שגיאה בחיבור ל-Google Calendar");
    } finally {
      setGcalLoading(false);
    }
  };

  const handleGcalDisconnect = async () => {
    setGcalLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      await fetch(`${BACKEND_URL}/api/integrations/google-calendar/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tenantId: teamMember?.tenant_id }),
      });
      setGcalStatus({ connected: false });
      toast.success("Google Calendar נותק");
    } catch {
      toast.error("שגיאה בניתוק");
    } finally {
      setGcalLoading(false);
    }
  };

  const isConfigured = (integrationId: string) => {
    if (integrationId === "google-calendar") return gcalStatus.connected;
    const integration = INTEGRATIONS.find(i => i.id === integrationId)!;
    return integration.fields.some(f => formValues[integrationId]?.[f.key]);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">אינטגרציות</h1>
          <p className="text-muted-foreground text-sm">חיבור שירותים חיצוניים ל-CRM</p>
        </div>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map(integration => {
          const isExpanded = expandedId === integration.id;
          const configured = isConfigured(integration.id);

          return (
            <div
              key={integration.id}
              className={cn(
                "border rounded-xl overflow-hidden transition-all",
                isExpanded ? "border-primary/30 shadow-md" : "border-border"
              )}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                className="w-full flex items-center gap-4 p-5 hover:bg-muted/30 transition-colors text-right"
              >
                <div className={cn("p-2.5 rounded-xl shrink-0", integration.color)}>
                  <integration.icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{integration.name}</h3>
                    {configured && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> מוגדר
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                </div>
                <span className={cn("transition-transform text-muted-foreground", isExpanded && "rotate-90")}>
                  ‹
                </span>
              </button>

              {/* Expanded config */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
                  {/* Google Calendar - OAuth connect button */}
                  {integration.oauthConnect ? (
                    <div className="space-y-3">
                      {gcalStatus.connected ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <Check size={16} className="text-green-600 shrink-0" />
                            <div className="text-sm">
                              <span className="font-medium text-green-800">מחובר</span>
                              {gcalStatus.email && (
                                <span className="text-green-600 mr-1" dir="ltr"> — {gcalStatus.email}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={handleGcalDisconnect}
                            disabled={gcalLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            {gcalLoading ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
                            נתק חיבור
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleGcalConnect}
                          disabled={gcalLoading}
                          className="flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium border border-input bg-background rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                          {gcalLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                          )}
                          התחבר עם Google
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Standard field-based config */}
                      {integration.fields.map(field => (
                        <div key={field.key}>
                          <label className="text-xs font-medium mb-1 block text-muted-foreground">{field.label}</label>
                          <input
                            type={field.type || "text"}
                            value={formValues[integration.id]?.[field.key] || ""}
                            onChange={e => updateField(integration.id, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
                            dir="ltr"
                          />
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(integration.id)}
                          disabled={saving === integration.id}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                          {saving === integration.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          שמור הגדרות
                        </button>
                        {integration.id === "email" && isConfigured("email") && (
                          <button
                            onClick={handleTestEmail}
                            disabled={testing === "email"}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            {testing === "email" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            שלח מייל בדיקה
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
