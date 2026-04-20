import { useState } from "react";
import { Plus, Zap, Play, Pause, Trash2, ChevronDown, Clock, Mail, MessageCircle, Edit3, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Automation } from "@/types/crm";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import AutomationBuilder from "@/components/automations/AutomationBuilder";
import { useConfirm } from "@/components/ui/confirm-dialog";

function useAutomations() {
  return useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Automation[];
    },
  });
}

const TRIGGER_LABELS: Record<string, string> = {
  record_created: "רשומה נוצרה",
  record_updated: "רשומה עודכנה",
  record_created_or_updated: "רשומה נוצרה או עודכנה",
  relative_time: "זמן יחסי",
  scheduled: "מתוזמן",
  webhook_received: "Webhook התקבל",
  form_submitted: "טופס נשלח",
};

const ACTION_ICONS: Record<string, any> = {
  send_email: Mail,
  send_whatsapp: MessageCircle,
  update_record: Edit3,
  create_record: Plus,
  webhook: Zap,
  wait: Clock,
};

export default function AutomationsPage() {
  const { data: automations, isLoading } = useAutomations();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("crm_automations")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("אוטומציה נמחקה");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">אוטומציות</h1>
          <p className="text-muted-foreground text-sm">
            {automations?.filter(a => a.is_active).length || 0} פעילות מתוך {automations?.length || 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/automations/logs")}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            <FileText size={14} />
            יומן הרצות
          </button>
          <button
            onClick={() => { setEditingId(null); setShowBuilder(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            אוטומציה חדשה
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : automations && automations.length > 0 ? (
        <div className="space-y-3">
          {automations.map(auto => (
            <div
              key={auto.id}
              className={cn(
                "bg-card border rounded-xl p-5 transition-all",
                auto.is_active ? "border-primary/20" : "border-border opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Toggle */}
                <button
                  onClick={() => toggleActive.mutate({ id: auto.id, is_active: !auto.is_active })}
                  className={cn(
                    "mt-1 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
                    auto.is_active ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-1",
                    auto.is_active ? "translate-x-1" : "translate-x-6"
                  )} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{auto.name}</h3>
                    {auto.is_active && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        פעיל
                      </span>
                    )}
                  </div>

                  {auto.description && (
                    <p className="text-sm text-muted-foreground mb-2">{auto.description}</p>
                  )}

                  {/* Trigger & Actions summary */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                      <Zap size={12} />
                      {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}
                    </span>
                    <span>→</span>
                    {auto.actions?.slice(0, 3).map((action: any, i: number) => {
                      const Icon = ACTION_ICONS[action.type] || Zap;
                      return (
                        <span key={i} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                          <Icon size={12} />
                          {action.type === "send_email" ? "שלח מייל" :
                           action.type === "send_whatsapp" ? "שלח WhatsApp" :
                           action.type === "update_record" ? "עדכן רשומה" :
                           action.type === "create_record" ? "צור רשומה" :
                           action.type === "webhook" ? "Webhook" :
                           action.type === "wait" ? "המתן" :
                           action.type}
                        </span>
                      );
                    })}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>הרצות: {auto.run_count}</span>
                    {auto.last_run_at && <span>הרצה אחרונה: {timeAgo(auto.last_run_at)}</span>}
                    {auto.error_count > 0 && (
                      <span className="text-destructive">שגיאות: {auto.error_count}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingId(auto.id); setShowBuilder(true); }}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: "מחיקת אוטומציה",
                        description: "למחוק את האוטומציה?",
                        confirmText: "מחק",
                        cancelText: "ביטול",
                        variant: "destructive",
                      });
                      if (!confirmed) return;
                      deleteAutomation.mutate(auto.id);
                    }}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Zap size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium mb-1">אין אוטומציות</p>
            <p className="text-sm">צור אוטומציות כדי לייעל תהליכים</p>
            <button
              onClick={() => setShowBuilder(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
            >
              צור אוטומציה ראשונה
            </button>
          </div>
        </div>
      )}

      {showBuilder && (
        <AutomationBuilder
          automationId={editingId}
          onClose={() => { setShowBuilder(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}
