import { useState, useEffect } from "react";
import { ArrowRight, MessageCircle, Calendar, Webhook, Mail, Key, ExternalLink, Check, Save, Loader2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  storagePrefix?: string; // for localStorage-based integrations
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: "whatsapp",
    name: "WhatsApp (Evolution API)",
    description: "חיבור WhatsApp Cloud API דרך Evolution API לשליחת הודעות ישירות מה-CRM",
    icon: MessageCircle,
    color: "text-emerald-500 bg-emerald-50",
    storagePrefix: "evo",
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
    storagePrefix: "resend",
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
    storagePrefix: "gcal",
    fields: [
      { key: "client-id", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "client-secret", label: "Client Secret", type: "password", placeholder: "GOCSPX-..." },
    ],
  },
  {
    id: "webhooks",
    name: "Webhooks & API",
    description: "הגדרת webhook endpoints לחיבור עם Zapier, Make ושירותים חיצוניים",
    icon: Webhook,
    color: "text-purple-500 bg-purple-50",
    storagePrefix: "webhook",
    fields: [
      { key: "api-key", label: "CRM API Key", placeholder: "ייווצר אוטומטית" },
      { key: "webhook-secret", label: "Webhook Secret", type: "password", placeholder: "סוד לאימות webhooks" },
    ],
  },
];

export default function IntegrationSettingsPage() {
  const navigate = useNavigate();
  const { teamMember } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // Load saved values
  useEffect(() => {
    const values: Record<string, Record<string, string>> = {};
    for (const integration of INTEGRATIONS) {
      values[integration.id] = {};
      for (const field of integration.fields) {
        const key = `${integration.storagePrefix}-${field.key}`;
        values[integration.id][field.key] = localStorage.getItem(key) || "";
      }
    }
    setFormValues(values);
  }, []);

  const handleSave = async (integrationId: string) => {
    const integration = INTEGRATIONS.find(i => i.id === integrationId)!;
    setSaving(integrationId);

    for (const field of integration.fields) {
      const key = `${integration.storagePrefix}-${field.key}`;
      const value = formValues[integrationId]?.[field.key] || "";
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    }

    // Also save to Supabase for server-side access
    await supabase.from("crm_integration_configs").upsert({
      provider: integrationId,
      config: formValues[integrationId] || {},
      is_active: true,
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

  const isConfigured = (integrationId: string) => {
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
