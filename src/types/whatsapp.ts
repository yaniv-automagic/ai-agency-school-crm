export interface WhatsAppMessage {
  id: string
  text: string
  timestamp: Date
  direction: "incoming" | "outgoing"
  status?: "sent" | "delivered" | "read"
  type?: "text" | "image" | "document" | "template"
  replyTo?: { id: string; text: string; fromMe: boolean }
  reactions?: string[]
}

export interface WhatsAppContact {
  name: string
  phone: string
  avatarUrl?: string
}

export interface WhatsAppTemplate {
  id: string
  name: string
  body: string
  category?: string
}

export interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instance: string
}

export const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  { id: "t1", name: "ברוכים הבאים", body: "שלום {{שם}}, ברוכים הבאים! נשמח לעזור לך בכל שאלה.", category: "כללי" },
  { id: "t2", name: "תזכורת פגישה", body: "היי {{שם}}, רצינו להזכיר לך שיש לנו פגישה ב-{{תאריך}}. מאשר/ת?", category: "תזכורות" },
  { id: "t3", name: "מעקב", body: "שלום {{שם}}, רציתי לעשות מעקב לגבי השיחה שלנו. האם יש משהו נוסף שאוכל לעזור?", category: "מעקב" },
  { id: "t4", name: "הזמנה לשיעור ניסיון", body: "היי {{שם}}! 🎓\nרצינו להזמין אותך לשיעור ניסיון בחינם בקורס שלנו.\nמתי נוח לך?", category: "מכירות" },
  { id: "t5", name: "תודה על ההרשמה", body: "{{שם}}, תודה רבה על ההרשמה! 🎉\nנשלח לך את כל הפרטים בקרוב.\nבינתיים, אם יש שאלות - אנחנו כאן.", category: "כללי" },
]

export function phoneToJid(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, "")
  if (cleaned.startsWith("0")) {
    cleaned = "972" + cleaned.slice(1)
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1)
  }
  return `${cleaned}@s.whatsapp.net`
}

export function formatPhoneForApi(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, "")
  if (cleaned.startsWith("0")) {
    cleaned = "972" + cleaned.slice(1)
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1)
  }
  return cleaned
}
