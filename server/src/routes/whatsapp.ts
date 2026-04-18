import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getEvoConfig, evoFetch } from "../lib/evolution.js";
import { authMiddleware } from "../middleware/auth.js";

export const whatsappRouter = Router();

// ── Webhook: receive incoming messages from Evolution API ──
whatsappRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const eventType = event.event;

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

      // Find contact by phone
      const { data: contact } = await supabase
        .from("crm_contacts")
        .select("id, tenant_id")
        .or(`phone.eq.${phone},whatsapp_phone.eq.${phone}`)
        .limit(1)
        .single();

      if (contact) {
        // Save message
        await supabase.from("crm_whatsapp_messages").insert({
          tenant_id: contact.tenant_id,
          contact_id: contact.id,
          remote_jid: remoteJid,
          message_id: message.key?.id,
          from_me: isFromMe,
          message_type: messageType,
          body: text,
          raw_data: message,
          status: "received",
        });

        // Create activity
        await supabase.from("crm_activities").insert({
          tenant_id: contact.tenant_id,
          contact_id: contact.id,
          type: "whatsapp",
          direction: isFromMe ? "outbound" : "inbound",
          subject: isFromMe ? "הודעת WhatsApp יוצאת" : "הודעת WhatsApp נכנסת",
          body: text,
          metadata: { remote_jid: remoteJid, message_type: messageType },
          performed_at: new Date().toISOString(),
        });

        // Update contact last_activity
        await supabase
          .from("crm_contacts")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", contact.id);
      }
    }

    // Handle message status updates (delivered, read)
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
            .eq("message_id", messageId);
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── Proxy: send message (keeps API key server-side) ──
whatsappRouter.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, phone, text } = req.body;
    const config = await getEvoConfig(tenantId);
    const result = await evoFetch(config, `message/sendText/${config.instance}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, text }),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy: send media ──
whatsappRouter.post("/send-media", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, phone, media, mimetype, fileName, caption } = req.body;
    const config = await getEvoConfig(tenantId);
    const isImage = mimetype?.startsWith("image/");
    const endpoint = isImage ? "message/sendImage" : "message/sendDocument";

    const result = await evoFetch(config, `${endpoint}/${config.instance}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, media, mimetype, fileName, caption: caption || "" }),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy: connection state ──
whatsappRouter.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    const config = await getEvoConfig(tenantId);
    const result = await evoFetch(config, `instance/connectionState/${config.instance}`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy: QR code ──
whatsappRouter.get("/qr", authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    const config = await getEvoConfig(tenantId);
    const result = await evoFetch(config, `instance/connect/${config.instance}`);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy: fetch messages ──
whatsappRouter.post("/messages", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tenantId, remoteJid, limit } = req.body;
    const config = await getEvoConfig(tenantId);
    const result = await evoFetch(config, `chat/findMessages/${config.instance}`, {
      method: "POST",
      body: JSON.stringify({ where: { key: { remoteJid } }, limit: limit || 50 }),
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
