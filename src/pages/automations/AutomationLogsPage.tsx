import { ArrowRight, CheckCircle, XCircle, AlertTriangle, Clock, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { cn, timeAgo } from "@/lib/utils";

interface AutomationLog {
  id: string;
  automation_id: string;
  trigger_record_id: string;
  trigger_record_type: string;
  status: "success" | "partial" | "failed" | "skipped";
  actions_executed: any;
  error_message: string | null;
  execution_time_ms: number;
  executed_at: string;
}

const STATUS_MAP: Record<string, { label: string; icon: any; cls: string }> = {
  success: { label: "הצלחה", icon: CheckCircle, cls: "text-green-600 bg-green-50" },
  partial: { label: "חלקי", icon: AlertTriangle, cls: "text-amber-600 bg-amber-50" },
  failed: { label: "נכשל", icon: XCircle, cls: "text-red-600 bg-red-50" },
  skipped: { label: "דולג", icon: Clock, cls: "text-gray-500 bg-gray-50" },
};

export default function AutomationLogsPage() {
  const navigate = useNavigate();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["automation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_automation_logs")
        .select("*, automation:crm_automations(name)")
        .order("executed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as (AutomationLog & { automation: { name: string } })[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/automations")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">יומן הרצות</h1>
          <p className="text-muted-foreground text-sm">היסטוריית הרצת אוטומציות</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">אוטומציה</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">סוג</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">זמן ריצה</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">בוצע</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">שגיאה</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const s = STATUS_MAP[log.status] || STATUS_MAP.skipped;
                return (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>
                        <s.icon size={12} />
                        {s.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{(log as any).automation?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.trigger_record_type || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.execution_time_ms ? `${log.execution_time_ms}ms` : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(log.executed_at)}</td>
                    <td className="px-4 py-3 text-xs text-destructive truncate max-w-[200px]">{log.error_message || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Zap size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">אין הרצות עדיין</p>
            <p className="text-sm mt-1">כשאוטומציה תרוץ, הלוג יופיע כאן</p>
          </div>
        </div>
      )}
    </div>
  );
}
