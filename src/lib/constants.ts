export const CONTACT_STATUSES = [
  { value: "new", label: "ליד חדש", color: "bg-blue-500" },
  { value: "contacted", label: "יצרנו קשר", color: "bg-yellow-500" },
  { value: "qualified", label: "מתעניין", color: "bg-orange-500" },
  { value: "student", label: "סטודנט", color: "bg-green-500" },
  { value: "alumni", label: "בוגר", color: "bg-purple-500" },
  { value: "inactive", label: "לא רלוונטי", color: "bg-gray-400" },
] as const;

export const CONTACT_SOURCES = [
  { value: "website", label: "אתר" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "הפניה" },
  { value: "facebook_ad", label: "פייסבוק" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "google_ad", label: "גוגל" },
  { value: "workshop", label: "סדנה" },
  { value: "manual", label: "הזנה ידנית" },
  { value: "import", label: "ייבוא" },
] as const;

export const DEAL_STATUSES = [
  { value: "open", label: "פתוח" },
  { value: "won", label: "נסגר בהצלחה" },
  { value: "lost", label: "אבוד" },
] as const;

export const TASK_PRIORITIES = [
  { value: "low", label: "נמוכה", color: "text-gray-500" },
  { value: "medium", label: "בינונית", color: "text-yellow-500" },
  { value: "high", label: "גבוהה", color: "text-orange-500" },
  { value: "urgent", label: "דחוף", color: "text-red-500" },
] as const;

export const TASK_TYPES = [
  { value: "task", label: "משימה", icon: "CheckSquare" },
  { value: "call", label: "שיחה", icon: "Phone" },
  { value: "meeting", label: "פגישה", icon: "Calendar" },
  { value: "follow_up", label: "מעקב", icon: "Clock" },
  { value: "email", label: "מייל", icon: "Mail" },
] as const;

export const ACTIVITY_TYPES = [
  { value: "note", label: "הערה", icon: "StickyNote", color: "text-gray-500" },
  { value: "call", label: "שיחה", icon: "Phone", color: "text-green-500" },
  { value: "email", label: "מייל", icon: "Mail", color: "text-blue-500" },
  { value: "meeting", label: "פגישה", icon: "Calendar", color: "text-purple-500" },
  { value: "whatsapp", label: "WhatsApp", icon: "MessageCircle", color: "text-emerald-500" },
  { value: "sms", label: "SMS", icon: "MessageSquare", color: "text-cyan-500" },
  { value: "stage_change", label: "שינוי שלב", icon: "ArrowLeftRight", color: "text-orange-500" },
  { value: "system", label: "מערכת", icon: "Settings", color: "text-muted-foreground" },
] as const;

export const PRODUCT_CATEGORIES = [
  { value: "course", label: "קורס" },
  { value: "workshop", label: "סדנה" },
  { value: "mentoring", label: "ליווי אישי" },
  { value: "bundle", label: "חבילה" },
] as const;

export const TEAM_ROLES = [
  { value: "owner", label: "בעלים" },
  { value: "admin", label: "מנהל" },
  { value: "sales", label: "מכירות" },
  { value: "marketing", label: "שיווק" },
  { value: "viewer", label: "צפייה בלבד" },
] as const;

export const CURRENCIES = [
  { value: "ILS", label: "₪", name: "שקל" },
  { value: "USD", label: "$", name: "דולר" },
  { value: "EUR", label: "€", name: "יורו" },
] as const;

export const MEETING_TYPES = [
  { value: "sales_consultation", label: "פגישת מכירה", color: "text-blue-500" },
  { value: "mentoring_1on1", label: "ליווי אישי 1:1", color: "text-purple-500" },
  { value: "mastermind_group", label: "מאסטרמיינד קבוצתי", color: "text-orange-500" },
  { value: "other", label: "אחר", color: "text-gray-500" },
] as const;

export const MEETING_STATUSES = [
  { value: "scheduled", label: "נקבעה", color: "bg-yellow-100 text-yellow-800" },
  { value: "rescheduled", label: "נדחתה", color: "bg-orange-100 text-orange-700" },
  { value: "cancelled", label: "בוטלה", color: "bg-red-100 text-red-700" },
  { value: "completed", label: "התקיימה", color: "bg-green-100 text-green-700" },
  { value: "no_show", label: "לא הגיע", color: "bg-gray-900 text-white" },
] as const;

export const MEETING_OUTCOMES = [
  { value: "won", label: "נסגר בהצלחה", color: "text-green-600" },
  { value: "lost", label: "לא סגר", color: "text-red-500" },
  { value: "follow_up", label: "דורש מעקב", color: "text-amber-500" },
  { value: "no_show", label: "לא הגיע", color: "text-gray-500" },
] as const;

export const ENROLLMENT_STATUSES = [
  { value: "pending", label: "ממתין", color: "bg-gray-100 text-gray-600" },
  { value: "active", label: "פעיל", color: "bg-green-100 text-green-700" },
  { value: "completed", label: "הושלם", color: "bg-blue-100 text-blue-700" },
  { value: "paused", label: "מושהה", color: "bg-amber-100 text-amber-700" },
  { value: "cancelled", label: "בוטל", color: "bg-red-100 text-red-700" },
] as const;

export const SESSION_TYPES = [
  { value: "personal", label: "פגישה אישית" },
  { value: "mastermind", label: "מאסטרמיינד" },
  { value: "course_access", label: "גישה לקורס" },
] as const;

export const SESSION_STATUSES = [
  { value: "planned", label: "מתוכנן", color: "bg-gray-100 text-gray-600" },
  { value: "scheduled", label: "נקבע", color: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "הושלם", color: "bg-green-100 text-green-700" },
  { value: "missed", label: "לא התקיים", color: "bg-red-100 text-red-700" },
  { value: "cancelled", label: "בוטל", color: "bg-gray-100 text-gray-500" },
] as const;

export const CONTRACT_STATUSES = [
  { value: "draft", label: "טיוטה", color: "bg-gray-100 text-gray-600" },
  { value: "sent", label: "נשלח", color: "bg-blue-100 text-blue-700" },
  { value: "viewed", label: "נצפה", color: "bg-amber-100 text-amber-700" },
  { value: "signed", label: "נחתם", color: "bg-green-100 text-green-700" },
  { value: "expired", label: "פג תוקף", color: "bg-red-100 text-red-700" },
  { value: "cancelled", label: "בוטל", color: "bg-gray-100 text-gray-500" },
] as const;

export const AD_PLATFORMS = [
  { value: "facebook", label: "פייסבוק" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "youtube", label: "יוטיוב" },
  { value: "google", label: "גוגל" },
  { value: "organic", label: "אורגני" },
] as const;

export const ENTRY_TYPES = [
  { value: "vsl", label: "VSL" },
  { value: "webinar", label: "וובינר" },
  { value: "organic", label: "אורגני" },
  { value: "direct", label: "ישיר" },
] as const;
