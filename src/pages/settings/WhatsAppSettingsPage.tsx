import { useState, useEffect, useCallback } from "react";
import { ArrowRight, MessageCircle, QrCode, Wifi, WifiOff, Trash2, Plus, Loader2, RefreshCw, LogOut, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as evo from "@/lib/evolution-api";
import type { WhatsAppInstance } from "@/lib/evolution-api";

export default function WhatsAppSettingsPage() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [teamInstances, setTeamInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [createForm, setCreateForm] = useState({ evoBaseUrl: "", evoApiKey: "", displayName: "" });
  const [creating, setCreating] = useState(false);
  const [qrData, setQrData] = useState<{ instanceId: string; base64: string } | null>(null);
  const [polling, setPolling] = useState<string | null>(null);

  const loadInstances = useCallback(async () => {
    try {
      const data = await evo.listInstances();
      setInstances(data);
    } catch (err: any) {
      console.error("Failed to load instances:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  // Poll connection status when showing QR
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const result = await evo.getConnectionStatus(polling);
        if (result.status === "connected") {
          setPolling(null);
          setQrData(null);
          toast.success("WhatsApp מחובר בהצלחה!");
          loadInstances();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, loadInstances]);

  const handleCreate = async () => {
    if (!createForm.evoBaseUrl || !createForm.evoApiKey) {
      toast.error("יש למלא את כתובת ה-API ואת ה-API Key");
      return;
    }
    setCreating(true);
    try {
      const instance = await evo.createInstance(
        createForm.evoBaseUrl,
        createForm.evoApiKey,
        createForm.displayName || undefined
      );
      toast.success("Instance נוצר! סרוק את ה-QR כדי לחבר.");
      setShowCreate(false);
      setCreateForm({ evoBaseUrl: "", evoApiKey: "", displayName: "" });
      await loadInstances();

      // Auto-show QR
      handleShowQR(instance.id);
    } catch (err: any) {
      toast.error(err.message || "שגיאה ביצירת instance");
    } finally {
      setCreating(false);
    }
  };

  const handleShowQR = async (instanceId: string) => {
    try {
      const data = await evo.getQRCode(instanceId);
      if (data.base64) {
        setQrData({ instanceId, base64: data.base64 });
        setPolling(instanceId);
      } else {
        toast.error("לא התקבל QR code");
      }
    } catch (err: any) {
      toast.error(err.message || "שגיאה בקבלת QR");
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    try {
      await evo.disconnectInstance(instanceId);
      toast.success("WhatsApp נותק");
      loadInstances();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm("למחוק את החיבור הזה?")) return;
    try {
      await evo.deleteInstance(instanceId);
      toast.success("חיבור נמחק");
      loadInstances();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLoadTeam = async () => {
    try {
      const data = await evo.listTeamInstances();
      setTeamInstances(data);
      setShowTeam(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "connected": return { text: "מחובר", color: "bg-green-100 text-green-700", icon: Wifi };
      case "connecting": return { text: "מתחבר...", color: "bg-yellow-100 text-yellow-700", icon: RefreshCw };
      case "banned": return { text: "חסום", color: "bg-red-100 text-red-700", icon: WifiOff };
      default: return { text: "מנותק", color: "bg-gray-100 text-gray-600", icon: WifiOff };
    }
  };

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">חיבור WhatsApp</h1>
          <p className="text-muted-foreground text-sm">כל משתמש יכול לחבר את חשבון ה-WhatsApp האישי שלו</p>
        </div>
        <button
          onClick={handleLoadTeam}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted/50"
        >
          <Users size={16} />
          צוות
        </button>
      </div>

      {/* QR Code Modal */}
      {qrData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => { setQrData(null); setPolling(null); }}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#25d366]/10 flex items-center justify-center mx-auto mb-4">
              <QrCode size={28} className="text-[#25d366]" />
            </div>
            <h3 className="text-lg font-bold mb-2">סרוק את ה-QR</h3>
            <p className="text-sm text-muted-foreground mb-4">פתח את WhatsApp בטלפון → הגדרות → מכשירים מקושרים → קישור מכשיר</p>
            <img src={qrData.base64} alt="QR Code" className="w-64 h-64 mx-auto mb-4" />
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                ממתין לסריקה...
              </div>
            )}
            <button
              onClick={() => handleShowQR(qrData.instanceId)}
              className="mt-3 text-sm text-primary hover:underline"
            >
              רענן QR
            </button>
          </div>
        </div>
      )}

      {/* My Instances */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map(instance => {
            const s = statusLabel(instance.status);
            const StatusIcon = s.icon;
            return (
              <div key={instance.id} className="border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#25d366]/10 flex items-center justify-center shrink-0">
                  <MessageCircle size={22} className="text-[#25d366]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{instance.instance_display_name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${s.color}`}>
                      <StatusIcon size={10} />
                      {s.text}
                    </span>
                  </div>
                  {instance.phone_number && (
                    <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">+{instance.phone_number}</p>
                  )}
                  {instance.last_connected_at && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      חיבור אחרון: {new Date(instance.last_connected_at).toLocaleDateString("he-IL")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {instance.status !== "connected" && (
                    <button
                      onClick={() => handleShowQR(instance.id)}
                      className="p-2 rounded-lg hover:bg-muted text-[#25d366]"
                      title="חבר עם QR"
                    >
                      <QrCode size={18} />
                    </button>
                  )}
                  {instance.status === "connected" && (
                    <button
                      onClick={() => handleDisconnect(instance.id)}
                      className="p-2 rounded-lg hover:bg-muted text-orange-500"
                      title="נתק"
                    >
                      <LogOut size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(instance.id)}
                    className="p-2 rounded-lg hover:bg-muted text-red-500"
                    title="מחק"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}

          {instances.length === 0 && !showCreate && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <div className="w-16 h-16 rounded-full bg-[#25d366]/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle size={28} className="text-[#25d366]" />
              </div>
              <h3 className="font-semibold mb-1">אין חשבון WhatsApp מחובר</h3>
              <p className="text-sm text-muted-foreground mb-4">חבר את ה-WhatsApp האישי שלך כדי לשלוח ולקבל הודעות</p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#25d366] text-white rounded-lg font-medium text-sm hover:bg-[#1da851]"
              >
                <Plus size={16} />
                חבר WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add button (when instances exist) */}
      {instances.length > 0 && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-xl w-full justify-center text-sm text-muted-foreground hover:text-foreground hover:border-primary/30"
        >
          <Plus size={16} />
          חבר WhatsApp נוסף
        </button>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="border rounded-xl p-5 space-y-4 bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus size={16} />
            חיבור WhatsApp חדש
          </h3>
          <p className="text-xs text-muted-foreground">הזן את פרטי שרת ה-Evolution API. אם אין לך שרת, פנה למנהל המערכת.</p>
          <div>
            <label className="text-xs font-medium mb-1 block">Evolution API URL</label>
            <input
              type="text"
              value={createForm.evoBaseUrl}
              onChange={e => setCreateForm(f => ({ ...f, evoBaseUrl: e.target.value }))}
              placeholder="https://evo.example.com"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">API Key</label>
            <input
              type="password"
              value={createForm.evoApiKey}
              onChange={e => setCreateForm(f => ({ ...f, evoApiKey: e.target.value }))}
              placeholder="your-api-key"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">שם תצוגה (אופציונלי)</label>
            <input
              type="text"
              value={createForm.displayName}
              onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="הוואטסאפ של יניב"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#25d366] rounded-lg hover:bg-[#1da851] disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              צור וחבר
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Team View */}
      {showTeam && (
        <div className="border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Users size={16} />
              חיבורי WhatsApp של הצוות
            </h3>
            <button onClick={() => setShowTeam(false)} className="text-xs text-muted-foreground hover:text-foreground">סגור</button>
          </div>
          {teamInstances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">אין חיבורים בצוות</p>
          ) : (
            teamInstances.map(inst => {
              const s = statusLabel(inst.status);
              const memberName = inst.team_member?.display_name || "משתמש";
              return (
                <div key={inst.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {memberName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{memberName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{inst.phone_number || "לא מחובר"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.color}`}>{s.text}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
