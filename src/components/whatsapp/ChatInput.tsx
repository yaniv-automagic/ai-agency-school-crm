import { useState, useRef, useCallback } from "react";
import type { WhatsAppTemplate } from "@/types/whatsapp";

const EMOJI_GROUPS = [
  { label: "נפוצים", emojis: ["😊", "😂", "❤️", "👍", "🙏", "😍", "🔥", "😎", "🎉", "💪", "👏", "🤝", "✅", "⭐", "💯", "🙌"] },
  { label: "פרצופים", emojis: ["😀", "😃", "😄", "😁", "😅", "🤣", "😇", "😉", "😋", "😘", "🤔", "😱", "😴", "🤗", "🤩", "😢"] },
  { label: "סמלים", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "✨", "💫", "🌟", "⚡", "🔔", "📌", "💡", "🎯"] },
];

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendFile?: (file: File) => void;
  templates?: WhatsAppTemplate[];
  onSelectTemplate?: (template: WhatsAppTemplate) => void;
  onSaveTemplate?: (name: string, body: string) => void;
}

export default function ChatInput({ onSend, onSendFile, templates, onSelectTemplate, onSaveTemplate }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    setShowTemplates(false);
    setShowEmojis(false);
    inputRef.current?.focus();
  }, [text, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="relative shrink-0">
      {/* Emoji picker */}
      {showEmojis && (
        <div className="absolute bottom-full left-0 right-0 bg-white border-t border-[#e9edef] max-h-[220px] overflow-y-auto shadow-lg z-10">
          {EMOJI_GROUPS.map(group => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-[11px] text-[#8696a0] font-semibold" dir="rtl">{group.label}</div>
              <div className="flex flex-wrap px-2" dir="ltr">
                {group.emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => { setText(prev => prev + emoji); inputRef.current?.focus(); }}
                    className="text-[22px] p-1.5 rounded-md hover:bg-[#f0f2f5]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates dropdown */}
      {showTemplates && (
        <div className="absolute bottom-full left-0 right-0 bg-white border-t border-[#e9edef] max-h-[250px] overflow-y-auto shadow-lg z-10">
          <div className="px-3 py-2 text-xs text-[#667781] font-semibold" dir="rtl">תבניות הודעה</div>
          {templates?.map(t => (
            <button
              key={t.id}
              onClick={() => { onSelectTemplate?.(t); setShowTemplates(false); }}
              className="block w-full text-right px-3 py-2 hover:bg-[#f0f2f5] border-b border-[#f0f2f5]"
              dir="rtl"
            >
              <div className="text-sm font-medium text-[#111b21]">{t.name}</div>
              <div className="text-xs text-[#667781] truncate mt-0.5">{t.body}</div>
              {t.category && <span className="text-[10px] text-[#8696a0]">{t.category}</span>}
            </button>
          ))}

          {/* New template */}
          {showNewTemplate ? (
            <div className="p-3 border-t border-[#e9edef]" dir="rtl">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="שם התבנית"
                className="w-full px-2 py-1.5 border rounded-md text-sm mb-2 outline-none"
              />
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                placeholder="תוכן... ({{שם}} {{תאריך}})"
                rows={2}
                className="w-full px-2 py-1.5 border rounded-md text-sm resize-none outline-none"
              />
              <button
                onClick={() => {
                  if (newName && newBody) {
                    onSaveTemplate?.(newName, newBody);
                    setNewName("");
                    setNewBody("");
                    setShowNewTemplate(false);
                  }
                }}
                disabled={!newName || !newBody}
                className="mt-2 w-full py-1.5 bg-[#25d366] text-white rounded-md text-sm font-medium disabled:opacity-50"
              >
                שמור תבנית
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewTemplate(true)}
              className="block w-full text-center py-2.5 text-sm text-[#25d366] font-semibold hover:bg-[#f0f2f5] border-t border-[#e9edef]"
            >
              + צור תבנית חדשה
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && onSendFile) onSendFile(file);
          e.target.value = "";
        }}
      />

      {/* Input bar */}
      <div className="flex items-end gap-1 px-2 py-1.5 bg-[#f0f2f5]" dir="ltr">
        {/* Emoji */}
        <button
          onClick={() => { setShowEmojis(s => !s); setShowTemplates(false); }}
          className={`p-1.5 rounded-full text-[22px] leading-none shrink-0 ${showEmojis ? "bg-[#e2e8f0]" : ""}`}
          title="אימוג'י"
        >
          😊
        </button>

        {/* Templates */}
        {templates && templates.length > 0 && (
          <button
            onClick={() => { setShowTemplates(s => !s); setShowEmojis(false); }}
            className={`p-1.5 rounded-full text-[#54656f] shrink-0 ${showTemplates ? "bg-[#e2e8f0]" : ""}`}
            title="תבניות"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"/>
            </svg>
          </button>
        )}

        {/* Attachment */}
        <button
          onClick={() => fileRef.current?.click()}
          className="p-1.5 rounded-full text-[#54656f] shrink-0"
          title="צירוף קובץ"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647c1.502 0 2.91-.585 3.972-1.646l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.501.501 1.128.801 1.765.853.637.051 1.21-.142 1.613-.544l5.484-5.482-.707-.707-5.484 5.482c-.217.22-.542.3-.882.27-.34-.03-.705-.216-1.006-.516-.601-.601-.67-1.468-.214-1.924l7.916-7.916c1.042-1.043 2.928-.94 4.11.241.59.59.958 1.322 1.016 2.046.058.703-.204 1.399-.738 1.932L8.397 19.577c-.869.869-2.023 1.347-3.25 1.347s-2.38-.479-3.245-1.342c-.87-.868-1.349-2.024-1.349-3.253 0-1.23.479-2.383 1.349-3.252l9.549-9.548.707.707-9.55 9.548c-.658.656-1.027 1.544-1.027 2.545z"/>
          </svg>
        </button>

        {/* Text area */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { setShowEmojis(false); setShowTemplates(false); }}
          placeholder="כתוב הודעה..."
          rows={1}
          className="flex-1 border-none outline-none rounded-lg px-3 py-2 text-sm resize-none bg-white text-[#111b21] max-h-[100px] overflow-y-auto leading-relaxed"
          dir="rtl"
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-1.5 rounded-full shrink-0 transition-colors"
          style={{ color: text.trim() ? "#075e54" : "#8696a0" }}
          title="שלח"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
