import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { TeamMember, TeamRole } from "@/types/crm";
import { Plus, Pencil, UserX, UserCheck, ArrowRight, Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const roleLabels: Record<TeamRole, string> = {
  owner: "בעלים",
  admin: "מנהל",
  sales: "מכירות",
  marketing: "שיווק",
  viewer: "צופה",
};

const roleColors: Record<TeamRole, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-purple-100 text-purple-800",
  sales: "bg-blue-100 text-blue-800",
  marketing: "bg-green-100 text-green-800",
  viewer: "bg-gray-100 text-gray-800",
};

export default function UsersPage() {
  const { teamMember } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<TeamRole>("viewer");
  const [formPassword, setFormPassword] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("crm_team_members")
      .select("*")
      .order("created_at", { ascending: true });
    setMembers((data as TeamMember[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const openCreate = () => {
    setEditingMember(null);
    setFormEmail("");
    setFormName("");
    setFormPhone("");
    setFormRole("viewer");
    setFormPassword("");
    setFormAvatarUrl("");
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormEmail(member.email);
    setFormName(member.display_name);
    setFormPhone(member.phone || "");
    setFormRole(member.role);
    setFormPassword("");
    setFormAvatarUrl(member.avatar_url || "");
    setError("");
    setDialogOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setError("יש להעלות קובץ תמונה בלבד");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("גודל התמונה מוגבל ל-2MB");
      return;
    }

    setUploadingAvatar(true);
    setError("");

    try {
      const ext = file.name.split(".").pop();
      const fileName = `avatars/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("crm-files")
        .upload(fileName, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("crm-files")
        .getPublicUrl(fileName);

      setFormAvatarUrl(urlData.publicUrl);
    } catch (err: any) {
      setError(err.message || "שגיאה בהעלאת התמונה");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);

    try {
      if (editingMember) {
        const { error: updateErr } = await supabase
          .from("crm_team_members")
          .update({
            display_name: formName,
            role: formRole,
            email: formEmail,
            phone: formPhone || null,
            avatar_url: formAvatarUrl || null,
          })
          .eq("id", editingMember.id);

        if (updateErr) throw updateErr;
      } else {
        if (!formEmail || !formName || !formPassword) {
          setError("יש למלא את כל השדות");
          setSaving(false);
          return;
        }

        if (formPassword.length < 6) {
          setError("הסיסמה חייבת להכיל לפחות 6 תווים");
          setSaving(false);
          return;
        }

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: {
            data: { display_name: formName },
          },
        });

        if (signUpErr) throw signUpErr;

        if (signUpData.user) {
          const { error: memberErr } = await supabase
            .from("crm_team_members")
            .insert({
              user_id: signUpData.user.id,
              tenant_id: teamMember?.tenant_id,
              display_name: formName,
              email: formEmail,
              phone: formPhone || null,
              role: formRole,
              avatar_url: formAvatarUrl || null,
              is_active: true,
            });

          if (memberErr) throw memberErr;
        }
      }

      setDialogOpen(false);
      fetchMembers();
    } catch (err: any) {
      setError(err.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member: TeamMember) => {
    if (member.role === "owner") return;
    if (member.id === teamMember?.id) return;

    await supabase
      .from("crm_team_members")
      .update({ is_active: !member.is_active })
      .eq("id", member.id);

    fetchMembers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
          <p className="text-muted-foreground text-sm">הוספה, עריכה וניהול משתמשי המערכת</p>
        </div>
        <div className="flex gap-2">
          {can("update", "users") && (
            <button
              onClick={() => navigate("/settings/permissions")}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
            >
              הרשאות תפקידים
              <ArrowRight size={16} />
            </button>
          )}
          {can("create", "users") && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Plus size={16} />
              הוספת משתמש
            </button>
          )}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">שם</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">אימייל</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">טלפון</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">תפקיד</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">סטטוס</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.display_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {member.display_name.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium">{member.display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">
                  {member.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                    {roleLabels[member.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    member.is_active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {member.is_active ? "פעיל" : "מושבת"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {can("update", "users") && (
                      <button
                        onClick={() => openEdit(member)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="עריכה"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {can("update", "users") && member.role !== "owner" && member.id !== teamMember?.id && (
                      <button
                        onClick={() => toggleActive(member)}
                        className={`p-1.5 rounded-md hover:bg-muted transition-colors ${
                          member.is_active
                            ? "text-red-500 hover:text-red-600"
                            : "text-emerald-500 hover:text-emerald-600"
                        }`}
                        title={member.is_active ? "השבתה" : "הפעלה"}
                      >
                        {member.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingMember ? "עריכת משתמש" : "הוספת משתמש חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center cursor-pointer group overflow-hidden border-2 border-border"
                onClick={() => fileInputRef.current?.click()}
              >
                {formAvatarUrl ? (
                  <img
                    src={formAvatarUrl}
                    alt="תמונת פרופיל"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    {formName ? formName.charAt(0) : "?"}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs text-primary hover:underline"
              >
                {uploadingAvatar ? "מעלה..." : "העלאת תמונת פרופיל"}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">שם תצוגה</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="שם מלא"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">אימייל</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={!!editingMember}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">טלפון</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="050-000-0000"
                dir="ltr"
              />
            </div>

            {!editingMember && (
              <div>
                <label className="block text-sm font-medium mb-1">סיסמה</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="לפחות 6 תווים"
                  dir="ltr"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">תפקיד</label>
              <Select
                value={formRole}
                onValueChange={v => setFormRole(v as TeamRole)}
                disabled={editingMember?.role === "owner"}
              >
                <SelectTrigger className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editingMember?.role === "owner" && <SelectItem value="owner">בעלים</SelectItem>}
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="sales">מכירות</SelectItem>
                  <SelectItem value="marketing">שיווק</SelectItem>
                  <SelectItem value="viewer">צופה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? "שומר..." : editingMember ? "שמירה" : "יצירת משתמש"}
              </button>
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
