import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(authMiddleware);

const ALLOWED_ROLES = ["owner", "admin", "sales", "marketing", "mentor", "viewer"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

usersRouter.post("/create", async (req: Request, res: Response) => {
  const caller = (req as any).user as { id: string };

  const { data: callerMember, error: callerErr } = await supabase
    .from("crm_team_members")
    .select("id, tenant_id, role, is_active")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (callerErr || !callerMember || !callerMember.is_active) {
    return res.status(403).json({ error: "אין הרשאה" });
  }
  if (callerMember.role !== "owner" && callerMember.role !== "admin") {
    return res.status(403).json({ error: "רק בעלים או מנהל יכולים להוסיף משתמשים" });
  }

  const { email, password, display_name, phone, role, avatar_url } = req.body ?? {};

  if (!email || !password || !display_name || !role) {
    return res.status(400).json({ error: "חסרים שדות חובה" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "סיסמה חייבת להיות לפחות 6 תווים" });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: "תפקיד לא חוקי" });
  }
  if (role === "owner") {
    return res.status(403).json({ error: "לא ניתן ליצור משתמש עם תפקיד בעלים" });
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? "שגיאה ביצירת משתמש";
    const isDup = /already|registered|exists|duplicate/i.test(msg);
    return res.status(isDup ? 409 : 500).json({ error: isDup ? "משתמש עם מייל זה כבר קיים" : msg });
  }

  const newAuthUserId = created.user.id;

  const { data: member, error: memberErr } = await supabase
    .from("crm_team_members")
    .insert({
      user_id: newAuthUserId,
      tenant_id: callerMember.tenant_id,
      display_name,
      email,
      phone: phone || null,
      role: role as Role,
      avatar_url: avatar_url || null,
      is_active: true,
    })
    .select()
    .single();

  if (memberErr) {
    // Rollback the auth user so we don't leave orphans behind.
    await supabase.auth.admin.deleteUser(newAuthUserId).catch(() => undefined);
    return res.status(500).json({ error: memberErr.message });
  }

  return res.status(201).json({ ok: true, member });
});
