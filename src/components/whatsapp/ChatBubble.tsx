import { useState, useRef, useCallback } from "react";
import type { WhatsAppMessage } from "@/types/whatsapp";

interface ChatBubbleProps {
  message: WhatsAppMessage;
  onReply?: (message: WhatsAppMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (message: WhatsAppMessage) => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function StatusIcon({ status }: { status?: string }) {
  if (!status) return null;
  const color = status === "read" ? "#53bdeb" : "#8696a0";
  if (status === "sent") {
    return (
      <svg viewBox="0 0 16 11" width="16" height="11" fill="none" style={{ marginRight: 2 }}>
        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.344.158.41.41 0 0 0-.107.3c0 .122.054.235.154.332L3.664 9.08a.532.532 0 0 0 .348.132.499.499 0 0 0 .384-.176l6.674-7.945a.437.437 0 0 0-.003-.438z" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" fill="none" style={{ marginRight: 2 }}>
      <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.463.463 0 0 0-.336-.153.457.457 0 0 0-.344.158.41.41 0 0 0-.107.3c0 .122.054.235.154.332L3.664 9.08a.532.532 0 0 0 .348.132.499.499 0 0 0 .384-.176l6.674-7.945a.437.437 0 0 0-.003-.438z" fill={color} />
      <path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.298-.463.565 1.313 1.448a.532.532 0 0 0 .348.132.499.499 0 0 0 .384-.176l6.674-7.945a.437.437 0 0 0-.003-.438z" fill={color} />
    </svg>
  );
}

export default function ChatBubble({ message, onReply, onReact, onDelete }: ChatBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const closeAll = () => { setShowMenu(false); setShowReactions(false); };

  return (
    <div
      className="flex px-2 py-0.5"
      style={{ justifyContent: isOutgoing ? "flex-end" : "flex-start", direction: "ltr" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTimeout(closeAll, 3000); }}
    >
      <div className="max-w-[65%] relative">
        {/* Reply context */}
        {message.replyTo && (
          <div
            className="rounded-t-lg px-2 py-1.5 text-xs"
            style={{
              background: isOutgoing ? "#c5eebf" : "#f0f0f0",
              borderRight: "3px solid #25d366",
              color: "#667781",
            }}
          >
            <div className="text-[11px] font-semibold" style={{ color: message.replyTo.fromMe ? "#075e54" : "#6366f1" }}>
              {message.replyTo.fromMe ? "את/ה" : "הם"}
            </div>
            <div className="truncate" dir="rtl">{message.replyTo.text}</div>
          </div>
        )}

        <div
          className="relative shadow-sm"
          style={{
            background: isOutgoing ? "#d9fdd3" : "#fff",
            borderRadius: message.replyTo
              ? (isOutgoing ? "0 0 0 8px" : "0 0 8px 0")
              : (isOutgoing ? "8px 8px 0 8px" : "8px 8px 8px 0"),
            padding: "6px 8px 4px",
          }}
        >
          {/* Chevron menu button */}
          {hovered && (onReply || onDelete) && (
            <button
              onClick={() => { setShowMenu(s => !s); setShowReactions(false); }}
              className="absolute top-1 text-[#8696a0] hover:text-[#54656f] z-10"
              style={{ [isOutgoing ? "left" : "right"]: 2 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path d="M3.3 4.6L9 10.3l5.7-5.7 1.6 1.6L9 13.4 1.7 6.2z"/>
              </svg>
            </button>
          )}

          {/* Message text */}
          <div className="text-sm leading-relaxed text-[#111b21] whitespace-pre-wrap break-words" dir="rtl" style={{ textAlign: "right" }}>
            {message.text}
          </div>

          {/* Time + status */}
          <div className="flex items-center justify-end gap-0.5 mt-0.5" dir="ltr">
            <span className="text-[11px] text-[#667781]">{formatTime(message.timestamp)}</span>
            {isOutgoing && <StatusIcon status={message.status} />}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-0.5 -mt-1.5" style={{ justifyContent: isOutgoing ? "flex-start" : "flex-end" }}>
            {message.reactions.map((emoji, i) => (
              <span key={i} className="bg-white rounded-xl px-1.5 py-0.5 text-[15px] shadow-sm">{emoji}</span>
            ))}
          </div>
        )}

        {/* Dropdown menu */}
        {showMenu && (
          <div
            className="absolute bg-white rounded-lg shadow-lg z-50 overflow-hidden min-w-[140px]"
            style={{ top: 30, [isOutgoing ? "left" : "right"]: 0 }}
            dir="rtl"
          >
            {onReply && (
              <button onClick={() => { onReply(message); closeAll(); }}
                className="block w-full text-right px-4 py-2.5 text-sm hover:bg-[#f0f2f5]">
                ↩️ השב
              </button>
            )}
            {onReact && (
              <button onClick={() => { setShowReactions(true); setShowMenu(false); }}
                className="block w-full text-right px-4 py-2.5 text-sm hover:bg-[#f0f2f5]">
                😊 הגב
              </button>
            )}
            {onDelete && (
              <button onClick={() => { onDelete(message); closeAll(); }}
                className="block w-full text-right px-4 py-2.5 text-sm text-red-500 hover:bg-[#f0f2f5]">
                🗑️ מחק
              </button>
            )}
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && onReact && (
          <div className="absolute -top-10 bg-white rounded-full shadow-lg px-2 py-1 flex gap-0.5 z-50"
            style={{ [isOutgoing ? "right" : "left"]: 0 }}>
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReact(message.id, emoji); closeAll(); }}
                className="text-xl p-1 rounded-lg hover:bg-[#f0f2f5] hover:scale-110 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
