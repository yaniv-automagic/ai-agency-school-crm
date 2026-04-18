import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Search, Phone, MoreVertical, Paperclip, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Contact } from "@/types/crm";
import type { WhatsAppMessage, WhatsAppTemplate } from "@/types/whatsapp";
import { DEFAULT_TEMPLATES, formatPhoneForApi, phoneToJid } from "@/types/whatsapp";
import * as evo from "@/lib/evolution-api";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";

interface WhatsAppChatProps {
  contact: Contact;
  onClose: () => void;
}

type ViewState = "checking" | "not-configured" | "qr" | "chat";

export default function WhatsAppChat({ contact, onClose }: WhatsAppChatProps) {
  const [view, setView] = useState<ViewState>("checking");
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<WhatsAppMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const phone = contact.whatsapp_phone || contact.phone || "";
  const formattedPhone = formatPhoneForApi(phone);

  // Load custom templates from localStorage
  const [customTemplates, setCustomTemplates] = useState<WhatsAppTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("crm-wa-templates");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  // Check connection on mount
  useEffect(() => {
    if (!evo.isConfigured()) {
      setView("not-configured");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const state = await evo.getConnectionState();
        if (cancelled) return;
        setView(state.state === "open" ? "chat" : "qr");
      } catch {
        if (!cancelled) setView("qr");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load messages when in chat view
  useEffect(() => {
    if (view !== "chat" || !formattedPhone) return;
    let cancelled = false;

    (async () => {
      setLoadingMessages(true);
      try {
        const jid = phoneToJid(phone);
        const data = await evo.findMessages(jid, 50) as any;
        if (cancelled) return;

        const records = data?.messages?.records || data?.messages || [];
        const rawMessages = Array.isArray(records) ? records : [];

        const msgs: WhatsAppMessage[] = rawMessages
          .filter((m: any) => {
            if (!m.message) return false;
            if (m.key?.deleted || m.messageType === "protocolMessage" || m.message.protocolMessage) return false;
            return m.message.conversation || m.message.extendedTextMessage?.text;
          })
          .map((m: any) => ({
            id: m.key?.id || m.id,
            text: m.message?.conversation || m.message?.extendedTextMessage?.text || "",
            timestamp: new Date((m.messageTimestamp || 0) * 1000),
            direction: m.key?.fromMe ? "outgoing" as const : "incoming" as const,
            status: "read" as const,
          }))
          .sort((a: WhatsAppMessage, b: WhatsAppMessage) => a.timestamp.getTime() - b.timestamp.getTime());

        setMessages(msgs);
      } catch (e) {
        console.warn("[CRM-WhatsApp] Failed to load messages:", e);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    // Load profile picture
    evo.fetchProfilePicture(formattedPhone).then(url => { if (url) setProfilePic(url); });

    return () => { cancelled = true; };
  }, [view, phone]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load QR code
  useEffect(() => {
    if (view !== "qr") return;
    let cancelled = false;
    (async () => {
      try {
        const qr = await evo.getQRCode();
        if (!cancelled && qr.base64) setQrBase64(qr.base64);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [view]);

  const handleSend = useCallback(async (text: string) => {
    const msg: WhatsAppMessage = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      timestamp: new Date(),
      direction: "outgoing",
      status: "sent",
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, fromMe: replyTo.direction === "outgoing" } : undefined,
    };
    setMessages(prev => [...prev, msg]);
    setReplyTo(null);

    // Save to DB
    supabase.from("crm_whatsapp_messages").insert({
      contact_id: contact.id,
      direction: "outbound",
      content: text,
      message_type: "text",
      status: "sent",
    });
    supabase.from("crm_activities").insert({
      contact_id: contact.id,
      type: "whatsapp",
      direction: "outbound",
      body: text,
    });

    // Send via Evolution API
    try {
      await evo.sendTextMessage(formattedPhone, text);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "delivered" as const } : m));
    } catch (e) {
      console.error("[CRM-WhatsApp] Send failed:", e);
    }

    queryClient.invalidateQueries({ queryKey: ["activities"] });
  }, [contact.id, formattedPhone, replyTo, queryClient]);

  const handleSendFile = useCallback(async (file: File) => {
    const msg: WhatsAppMessage = {
      id: Date.now().toString(36),
      text: `📎 ${file.name}`,
      timestamp: new Date(),
      direction: "outgoing",
      status: "sent",
      type: file.type.startsWith("image/") ? "image" : "document",
    };
    setMessages(prev => [...prev, msg]);

    try {
      await evo.sendMedia(formattedPhone, file);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "delivered" as const } : m));
    } catch {
      toast.error("שגיאה בשליחת הקובץ");
    }
  }, [formattedPhone]);

  const handleSelectTemplate = useCallback((template: WhatsAppTemplate) => {
    const body = template.body
      .replace(/\{\{שם\}\}/g, `${contact.first_name} ${contact.last_name}`)
      .replace(/\{\{תאריך\}\}/g, new Date().toLocaleDateString("he-IL"));
    handleSend(body);
  }, [contact, handleSend]);

  const handleSaveTemplate = useCallback((name: string, body: string) => {
    const t: WhatsAppTemplate = {
      id: "custom-" + Date.now(),
      name,
      body,
      category: "מותאם אישית",
    };
    const updated = [...customTemplates, t];
    setCustomTemplates(updated);
    localStorage.setItem("crm-wa-templates", JSON.stringify(updated));
    toast.success("תבנית נשמרה");
  }, [customTemplates]);

  const handleDeleteMessage = useCallback((msg: WhatsAppMessage) => {
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  }, []);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reactions: [...(m.reactions || []), emoji] } : m
    ));
  }, []);

  // Group messages by date
  const grouped = groupByDate(
    searchQuery ? messages.filter(m => m.text.includes(searchQuery)) : messages
  );

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 w-full max-w-md flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: "'Heebo', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#075e54] text-white shrink-0" dir="ltr">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <ArrowRight size={20} style={{ transform: "scaleX(-1)" }} />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#25d366] flex items-center justify-center font-semibold text-lg overflow-hidden shrink-0">
            {profilePic
              ? <img src={profilePic} alt="" className="w-full h-full object-cover" />
              : `${contact.first_name?.charAt(0)}${contact.last_name?.charAt(0)}`
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] truncate">{contact.first_name} {contact.last_name}</p>
            <p className="text-xs text-white/70">{phone}</p>
          </div>
          <button onClick={() => { setShowSearch(s => !s); setSearchQuery(""); }} className="p-2 rounded-full hover:bg-white/10">
            <Search size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10">
            <Phone size={18} />
          </button>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] shrink-0" dir="rtl">
            <Search size={14} className="text-[#54656f] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="חיפוש בשיחה..."
              autoFocus
              className="flex-1 border-none outline-none bg-white rounded-md px-3 py-1.5 text-sm"
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-[#54656f] text-sm p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content */}
        {view === "checking" && (
          <div className="flex-1 flex items-center justify-center bg-white" dir="rtl">
            <p className="text-[#667781] text-[15px]">בודק חיבור WhatsApp...</p>
          </div>
        )}

        {view === "not-configured" && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white px-8" dir="rtl">
            <div className="w-20 h-20 rounded-full bg-[#25d366]/10 flex items-center justify-center mb-4">
              <Phone size={32} className="text-[#25d366]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">WhatsApp לא מוגדר</h3>
            <p className="text-sm text-[#667781] text-center mb-4">
              כדי להשתמש ב-WhatsApp, הגדר את Evolution API בהגדרות האינטגרציות
            </p>
            <div className="w-full space-y-3 bg-[#f0f2f5] rounded-xl p-4 text-sm">
              <p className="font-medium">הגדרות נדרשות:</p>
              <div>
                <label className="text-xs text-[#667781]">Evolution API URL</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem("evo-api-url") || ""}
                  onChange={e => localStorage.setItem("evo-api-url", e.target.value)}
                  placeholder="http://localhost:8081"
                  className="w-full px-3 py-2 rounded-lg border text-sm mt-1 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-[#667781]">API Key</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem("evo-api-key") || ""}
                  onChange={e => localStorage.setItem("evo-api-key", e.target.value)}
                  placeholder="your-api-key"
                  className="w-full px-3 py-2 rounded-lg border text-sm mt-1 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-[#667781]">Instance Name</label>
                <input
                  type="text"
                  defaultValue={localStorage.getItem("evo-api-instance") || "crm-whatsapp"}
                  onChange={e => localStorage.setItem("evo-api-instance", e.target.value)}
                  placeholder="crm-whatsapp"
                  className="w-full px-3 py-2 rounded-lg border text-sm mt-1 outline-none"
                  dir="ltr"
                />
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 bg-[#25d366] text-white rounded-lg font-medium text-sm"
              >
                שמור ונסה להתחבר
              </button>
            </div>
          </div>
        )}

        {view === "qr" && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white px-8" dir="rtl">
            <h3 className="text-lg font-semibold mb-2">חבר את WhatsApp</h3>
            <p className="text-sm text-[#667781] text-center mb-6">סרוק את קוד ה-QR עם WhatsApp בטלפון שלך</p>
            {qrBase64 ? (
              <img src={qrBase64} alt="QR Code" className="w-64 h-64 mb-4" />
            ) : (
              <div className="w-64 h-64 bg-[#f0f2f5] rounded-xl flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25d366]" />
              </div>
            )}
            <button
              onClick={() => setView("checking")}
              className="px-6 py-2 bg-[#25d366] text-white rounded-lg font-medium text-sm"
            >
              כבר סרקתי, בדוק שוב
            </button>
          </div>
        )}

        {view === "chat" && (
          <>
            {/* Messages area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto py-2"
              style={{
                backgroundColor: "#efeae2",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' patternUnits='userSpaceOnUse' width='80' height='80'%3E%3Ccircle cx='40' cy='40' r='1.5' fill='%23d1cdc7' opacity='.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23p)'/%3E%3C/svg%3E")`,
              }}
            >
              {loadingMessages && (
                <p className="text-center text-[#667781] text-sm py-4">טוען הודעות...</p>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-[#25d366]/10 flex items-center justify-center mx-auto mb-3">
                    <Phone size={24} className="text-[#25d366]" />
                  </div>
                  <p className="text-sm text-[#667781]">אין הודעות עדיין. שלח הודעה ראשונה!</p>
                </div>
              )}
              {grouped.map(({ date, messages: dayMsgs }) => (
                <div key={date}>
                  <div className="flex justify-center py-2">
                    <span className="bg-white rounded-lg px-3 py-1 text-xs text-[#54656f] shadow-sm">
                      {date}
                    </span>
                  </div>
                  {dayMsgs.map(msg => (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      onReply={setReplyTo}
                      onReact={handleReact}
                      onDelete={handleDeleteMessage}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Reply bar */}
            {replyTo && (
              <div className="flex items-center px-3 py-2 bg-[#f0f2f5] border-t border-[#e9edef] gap-2 shrink-0" dir="rtl">
                <div className="flex-1 border-r-[3px] border-[#25d366] pr-2 min-w-0">
                  <p className="text-[11px] font-semibold" style={{ color: replyTo.direction === "outgoing" ? "#075e54" : "#6366f1" }}>
                    {replyTo.direction === "outgoing" ? "את/ה" : contact.first_name}
                  </p>
                  <p className="text-xs text-[#667781] truncate">{replyTo.text}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-[#667781] p-1">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              onSendFile={handleSendFile}
              templates={allTemplates}
              onSelectTemplate={handleSelectTemplate}
              onSaveTemplate={handleSaveTemplate}
            />
          </>
        )}
      </div>
    </div>
  );
}

function groupByDate(messages: WhatsAppMessage[]): { date: string; messages: WhatsAppMessage[] }[] {
  const groups = new Map<string, WhatsAppMessage[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const msg of messages) {
    const ds = msg.timestamp.toDateString();
    const label = ds === today ? "היום" : ds === yesterday ? "אתמול"
      : msg.timestamp.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }

  return Array.from(groups.entries()).map(([date, messages]) => ({ date, messages }));
}
