export type WidgetType = "number" | "bar" | "pie" | "line" | "funnel" | "kpi-row" | "table"

export interface KpiData {
  id: string
  label: string
  value: number
  formattedValue: string
  subtitle?: string
  trend?: { direction: "up" | "down" | "neutral"; percent: number }
  color?: string
}

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface WidgetFilter {
  field: string
  operator: "eq" | "ne" | "gt" | "lt" | "contains" | "is-null" | "is-not-null"
  value: string
}

export interface FunnelStage {
  label: string
  fieldValue: string
  color: string
}

export interface WidgetConfig {
  title: string
  type: WidgetType
  kpiData?: KpiData
  kpiList?: KpiData[]
  chartData?: ChartDataPoint[]
  dataSource?: string // CRM table: 'contacts', 'deals', 'tasks', 'activities', 'products'
  metric?: string
  groupBy?: string
  dateFilter?: string
  filters?: WidgetFilter[]
  funnelField?: string
  funnelStages?: FunnelStage[]
}

export interface GridWidget {
  i: string
  x: number
  y: number
  w: number
  h: number
  config: WidgetConfig
}

export interface DashboardLayout {
  id: string
  name: string
  widgets: GridWidget[]
}

export const CRM_DATA_SOURCES = [
  { value: "crm_contacts", label: "אנשי קשר" },
  { value: "crm_deals", label: "עסקאות" },
  { value: "crm_tasks", label: "משימות" },
  { value: "crm_activities", label: "פעילויות" },
  { value: "crm_meetings", label: "פגישות" },
  { value: "crm_program_enrollments", label: "תלמידים / הרשמות" },
  { value: "crm_contracts", label: "חוזים" },
  { value: "crm_ad_daily_stats", label: "הוצאות פרסום" },
  { value: "crm_products", label: "מוצרים" },
  { value: "crm_campaigns", label: "קמפיינים" },
] as const

export const CRM_GROUPBY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  crm_contacts: [
    { value: "", label: "ללא" },
    { value: "created_month", label: "חודש יצירה" },
    { value: "status", label: "סטטוס" },
    { value: "source", label: "מקור" },
    { value: "city", label: "עיר" },
  ],
  crm_deals: [
    { value: "", label: "ללא" },
    { value: "created_month", label: "חודש יצירה" },
    { value: "status", label: "סטטוס" },
    { value: "stage_name", label: "שלב" },
  ],
  crm_tasks: [
    { value: "", label: "ללא" },
    { value: "status", label: "סטטוס" },
    { value: "priority", label: "עדיפות" },
    { value: "type", label: "סוג" },
  ],
  crm_activities: [
    { value: "", label: "ללא" },
    { value: "type", label: "סוג" },
    { value: "created_month", label: "חודש" },
  ],
  crm_products: [
    { value: "", label: "ללא" },
    { value: "category", label: "קטגוריה" },
  ],
  crm_campaigns: [
    { value: "", label: "ללא" },
    { value: "type", label: "ערוץ" },
    { value: "status", label: "סטטוס" },
  ],
  crm_meetings: [
    { value: "", label: "ללא" },
    { value: "meeting_type", label: "סוג פגישה" },
    { value: "status", label: "סטטוס" },
    { value: "outcome", label: "תוצאה" },
    { value: "created_month", label: "חודש" },
  ],
  crm_program_enrollments: [
    { value: "", label: "ללא" },
    { value: "status", label: "סטטוס" },
  ],
  crm_contracts: [
    { value: "", label: "ללא" },
    { value: "status", label: "סטטוס" },
  ],
  crm_ad_daily_stats: [
    { value: "", label: "ללא" },
    { value: "date_month", label: "חודש" },
  ],
}

export const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#a855f7", "#d946ef",
]

export const MONTH_NAMES = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"]

export const FIELD_LABELS: Record<string, Record<string, string>> = {
  status: { new: "חדש", contacted: "יצרנו קשר", qualified: "מתעניין", student: "סטודנט", alumni: "בוגר", inactive: "לא פעיל", open: "פתוח", won: "נסגר", lost: "אבוד", draft: "טיוטה", scheduled: "מתוזמן", sending: "נשלח", sent: "נשלח", cancelled: "בוטל", pending: "ממתין", in_progress: "בתהליך", completed: "הושלם", confirmed: "אושר", no_show: "לא הגיע", rescheduled: "נדחה", active: "פעיל", paused: "מושהה", viewed: "נצפה", signed: "נחתם", expired: "פג תוקף", planned: "מתוכנן", missed: "לא התקיים" },
  source: { website: "אתר", whatsapp: "WhatsApp", referral: "הפניה", facebook_ad: "פייסבוק", instagram: "אינסטגרם", google_ad: "גוגל", workshop: "סדנה", manual: "ידני", import: "ייבוא" },
  priority: { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחוף" },
  type: { task: "משימה", call: "שיחה", meeting: "פגישה", follow_up: "מעקב", email: "מייל", note: "הערה", whatsapp: "WhatsApp", sms: "SMS", stage_change: "שינוי שלב", system: "מערכת" },
  category: { course: "קורס", workshop: "סדנה", mentoring: "ליווי", bundle: "חבילה" },
  meeting_type: { sales_consultation: "פגישת מכירה", mentoring_1on1: "ליווי אישי", mastermind_group: "מאסטרמיינד", trial_lesson: "שיעור ניסיון" },
  outcome: { won: "נסגר", lost: "לא סגר", follow_up: "מעקב", no_show: "לא הגיע" },
  ad_platform: { facebook: "פייסבוק", instagram: "אינסטגרם", youtube: "יוטיוב", google: "גוגל", organic: "אורגני" },
  entry_type: { vsl: "VSL", webinar: "וובינר", organic: "אורגני", direct: "ישיר" },
}
