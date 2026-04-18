import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { evoFetch } from "../lib/evolution.js";
import { authMiddleware } from "../middleware/auth.js";

export const whatsappRouter = Router();

// ── Helper: get user's WhatsApp instance config ──
async function getUserInstance(userId: string, instanceId?: string | string[]) {
  if (Array.isArray(instanceId)) instanceId = instanceId[0];
  const query = supabase
    .from("crm_whatsapp_instances")
    .select("*")
    .eq("user_id", userId);

  if (instanceId) {
    query.eq("id", instanceId);
  } else {
    query.eq("is_default", true);
  }

  const { data, error } = await query.single();
  if (error || !data) {
    // Fallback: get any instance for this user
    if (!instanceId) {
      const { data: any } = await supabase
        .from("crm_whatsapp_instances")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .single();
      if (any) return any;
    }
    throw new Error("WhatsApp לא מחובר. יש לחבר חשבון WhatsApp בהגדרות.");
  }
  return data;
}

function instanceToConfig(instance: any) {
  return {
    baseUrl: instance.evo_base_url,
    apiKey: instance.evo_api_key,
    instance: instance.instance_name,
  };
}

// ══════════════════════════════════════════════
// Instance Management (per-user)
// ══════════════════════════════════════════════

// ── Create a new WhatsApp instance for a user ──
whatsappRouter.post("/instances", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { displayName, evoBaseUrl, evoApiKey } = req.body;

    // Get team member
    const { data: member } = await supabase
      .from("crm_team_members")
      .select("id, tenant_id, display_name")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return res.status(403).json({ error: "User is not a team member" });
    }

    // Generate unique instance name
    const instanceName = `wa-${member.tenant_id}-${user.id}`.slice(0, 40);

    // Create instance in Evolution API
    try {
      await evoFetch(
        { baseUrl: evoBaseUrl, apiKey: evoApiKey, instance: "" },
        "instance/create",
        {
          method: "POST",
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        }
      );
    } catch (err: any) {
      // Instance might already exist, that's ok
      if (!err.message?.includes("already")) {
        throw err;
      }
    }

    // Check if user already has an instance
    const { data: existing } = await supabase
      .from("crm_whatsapp_instances")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const isDefault = !existing?.length;

    // Save to DB
    const { data: instance, error } = await supabase
      .from("crm_whatsapp_instances")
      .insert({
        tenant_id: member.tenant_id,
        user_id: user.id,
        team_member_id: member.id,
        instance_name: instanceName,
        instance_display_name: displayName || `WhatsApp של ${member.display_name}`,
        evo_base_url: evoBaseUrl,
        evo_api_key: evoApiKey,
        status: "disconnected",
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) throw error;

    // Set up webhook on Evolution API to point to our backend
    const backendUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || "";
    if (backendUrl) {
      try {
        await evoFetch(
          { baseUrl: evoBaseUrl, apiKey: evoApiKey, instance: instanceName },
          `webhook/set/${instanceName}`,
          {
            method: "POST",
            body: JSON.stringify({
              enabled: true,
              url: `${backendUrl}/api/whatsapp/webhook/${instance!.id}`,
              webhookByEvents: false,
              events: [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "CONNECTION_UPDATE",
              ],
            }),
          }
        );
      } catch (err) {
        console.error("Failed to set webhook:", err);
      }
    }

    res.json(instance);
  } catch (err: any) {
    console.error("Create instance error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── List user's instances ──
whatsappRouter.get("/instances", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { data, error } = await supabase
      .from("crm_whatsapp_instances")
      .select("id, instance_name, instance_display_name, phone_number, status, profile_picture_url, is_default, last_connected_at, created_at")
      .eq("user_id", user.id)
      .order("created_at");

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── List all team instances (for admin/owner) ──
whatsappRouter.get("/instances/team", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const { data: member } = await supabase
      .from("crm_team_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return res.status(403).json({ error: "Not a team member" });
    }

    const { data, error } = await supabase
      .from("crm_whatsapp_instances")
      .select("id, instance_display_name, phone_number, status, is_default, team_member_id, last_connected_at, created_at, team_member:crm_team_members(display_name, avatar_url)")
      .eq("tenant_id", member.tenant_id)
      .order("created_at");

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete instance ──
whatsappRouter.delete("/instances/:instanceId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { instanceId } = req.params;

    const instance = await getUserInstance(user.id, instanceId);

    // Delete from Evolution API
    try {
      await evoFetch(
        instanceToConfig(instance),
        `instance/delete/${instance.instance_name}`,
        { method: "DELETE" }
      );
    } catch (err) {
      console.error("Failed to delete from Evolution API:", err);
    }

    // Delete from DB
    await supabase
      .from("crm_whatsapp_instances")
      .delete()
      .eq("id", instanceId)
      .eq("user_id", user.id);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════
// Connection (QR Code)
// ══════════════════════════════════════════════

// ── Get QR code for connecting ──
whatsappRouter.get("/instances/:instanceId/qr", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const instance = await getUserInstance(user.id, req.params.instanceId);
    const config = instanceToConfig(instance);

    const result = await evoFetch(config, `instance/connect/${instance.instance_name}`);

    // Update status to connecting
    await supabase
      .from("crm_whatsapp_instances")
      .update({ status: "connecting", updated_at: new Date().toISOString() })
      .eq("id", instance.id);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get connection status ──
whatsappRouter.get("/instances/:instanceId/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const instance = await getUserInstance(user.id, req.params.instanceId);
    const config = instanceToConfig(instance);

    const result = await evoFetch(config, `instance/connectionState/${instance.instance_name}`);
    const state = result?.instance?.state || result?.state || "close";

    // Sync status to DB
    const newStatus = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
    if (newStatus !== instance.status) {
      const update: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "connected") {
        update.last_connected_at = new Date().toISOString();
      }
      await supabase.from("crm_whatsapp_instances").update(update).eq("id", instance.id);
    }

    res.json({ status: newStatus, raw: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Disconnect (logout) ──
whatsappRouter.post("/instances/:instanceId/disconnect", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const instance = await getUserInstance(user.id, req.params.instanceId);
    const config = instanceToConfig(instance);

    await evoFetch(config, `instance/logout/${instance.instance_name}`, { method: "DELETE" });

    await supabase
      .from("crm_whatsapp_instances")
      .update({ status: "disconnected", phone_number: null, updated_at: new Date().toISOString() })
      .eq("id", instance.id);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════
// Messaging (per-user instance)
// ══════════════════════════════════════════════

// ── Send text message ──
whatsappRouter.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phone, text, instanceId } = req.body;
    const instance = await getUserInstance(user.id, instanceId);
    const config = instanceToConfig(instance);

    const result = await evoFetch(config, `message/sendText/${instance.instance_name}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, text }),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Send media ──
whatsappRouter.post("/send-media", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phone, media, mimetype, fileName, caption, instanceId } = req.body;
    const instance = await getUserInstance(user.id, instanceId);
    const config = instanceToConfig(instance);

    const isImage = mimetype?.startsWith("image/");
    const endpoint = isImage ? "message/sendImage" : "message/sendDocument";

    const result = await evoFetch(config, `${endpoint}/${instance.instance_name}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, media, mimetype, fileName, caption: caption || "" }),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fetch messages ──
whatsappRouter.post("/messages", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { remoteJid, limit, instanceId } = req.body;
    const instance = await getUserInstance(user.id, instanceId);
    const config = instanceToConfig(instance);

    const result = await evoFetch(config, `chat/findMessages/${instance.instance_name}`, {
      method: "POST",
      body: JSON.stringify({ where: { key: { remoteJid } }, limit: limit || 50 }),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fetch profile picture ──
whatsappRouter.post("/profile-picture", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phone, instanceId } = req.body;
    const instance = await getUserInstance(user.id, instanceId);
    const config = instanceToConfig(instance);

    const result = await evoFetch(config, `chat/fetchProfilePictureUrl/${instance.instance_name}`, {
      method: "POST",
      body: JSON.stringify({ number: phone }),
    });
    res.json({ url: result?.profilePictureUrl || result?.wpiUrl || null });
  } catch (err: any) {
    res.json({ url: null });
  }
});

// ══════════════════════════════════════════════
// Webhook (receives events from Evolution API)
// ══════════════════════════════════════════════

// ── Per-instance webhook ──
whatsappRouter.post("/webhook/:instanceId", async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const event = req.body;
    const eventType = event.event;

    // Get instance info
    const { data: instance } = await supabase
      .from("crm_whatsapp_instances")
      .select("id, tenant_id, user_id, instance_name, status")
      .eq("id", instanceId)
      .single();

    if (!instance) {
      return res.json({ ok: true, skipped: "unknown instance" });
    }

    // Handle connection updates
    if (eventType === "connection.update") {
      const state = event.data?.state || event.data?.status;
      if (state === "open") {
        // Get phone number from connection
        const phoneNumber = event.data?.instance?.wuid?.replace("@s.whatsapp.net", "") || null;
        await supabase
          .from("crm_whatsapp_instances")
          .update({
            status: "connected",
            phone_number: phoneNumber,
            last_connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", instanceId);
      } else if (state === "close") {
        await supabase
          .from("crm_whatsapp_instances")
          .update({ status: "disconnected", updated_at: new Date().toISOString() })
          .eq("id", instanceId);
      }
    }

    // Handle incoming messages
    if (eventType === "messages.upsert") {
      const message = event.data;
      const remoteJid = message.key?.remoteJid;
      if (!remoteJid || remoteJid === "status@broadcast") {
        return res.json({ ok: true });
      }

      const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const isFromMe = message.key?.fromMe || false;
      const text = message.message?.conversation
        || message.message?.extendedTextMessage?.text
        || "";
      const messageType = message.message?.imageMessage ? "image"
        : message.message?.documentMessage ? "document"
        : message.message?.audioMessage ? "audio"
        : message.message?.videoMessage ? "video"
        : "text";

      // Find contact by phone in this tenant
      const { data: contact } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("tenant_id", instance.tenant_id)
        .or(`phone.eq.${phone},whatsapp_phone.eq.${phone}`)
        .limit(1)
        .single();

      if (contact) {
        // Save message
        await supabase.from("crm_whatsapp_messages").insert({
          tenant_id: instance.tenant_id,
          contact_id: contact.id,
          instance_id: instance.id,
          sender_user_id: isFromMe ? instance.user_id : null,
          wa_message_id: message.key?.id,
          direction: isFromMe ? "outbound" : "inbound",
          message_type: messageType,
          content: text,
          status: isFromMe ? "sent" : "received",
        });

        // Create activity
        await supabase.from("crm_activities").insert({
          tenant_id: instance.tenant_id,
          contact_id: contact.id,
          type: "whatsapp",
          direction: isFromMe ? "outbound" : "inbound",
          subject: isFromMe ? "הודעת WhatsApp יוצאת" : "הודעת WhatsApp נכנסת",
          body: text,
          metadata: {
            remote_jid: remoteJid,
            message_type: messageType,
            instance_id: instance.id,
            user_id: instance.user_id,
          },
          performed_by: isFromMe ? instance.user_id : null,
          performed_at: new Date().toISOString(),
        });

        // Update contact
        await supabase
          .from("crm_contacts")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", contact.id);
      }
    }

    // Handle message status updates
    if (eventType === "messages.update") {
      const updates = Array.isArray(event.data) ? event.data : [event.data];
      for (const update of updates) {
        const messageId = update.key?.id;
        const status = update.update?.status === 3 ? "delivered"
          : update.update?.status === 4 ? "read"
          : null;

        if (messageId && status) {
          await supabase
            .from("crm_whatsapp_messages")
            .update({ status })
            .eq("wa_message_id", messageId)
            .eq("instance_id", instanceId);
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
