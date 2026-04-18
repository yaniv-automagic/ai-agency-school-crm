import { useNavigate } from "react-router-dom";
import { Database, Webhook, FileText, Upload, FileSignature, Target, FormInput, MessageCircle, Users, Shield } from "lucide-react";

const settingsSections = [
  {
    title: "ניהול משתמשים",
    description: "הוספה, עריכה והשבתת משתמשים במערכת",
    icon: Users,
    path: "/settings/users",
    color: "bg-cyan-50 text-cyan-500",
  },
  {
    title: "הרשאות תפקידים",
    description: "הגדרת הרשאות יצירה, צפייה, עריכה ומחיקה פר תפקיד",
    icon: Shield,
    path: "/settings/permissions",
    color: "bg-amber-50 text-amber-500",
  },
  {
    title: "חיבור WhatsApp",
    description: "חיבור חשבון WhatsApp אישי לשליחה וקבלת הודעות",
    icon: MessageCircle,
    path: "/settings/whatsapp",
    color: "bg-emerald-50 text-emerald-500",
  },
  {
    title: "צנרות מכירות",
    description: "ניהול צנרות, שלבים, צבעים והסתברויות",
    icon: Database,
    path: "/settings/pipelines",
    color: "bg-blue-50 text-blue-500",
  },
  {
    title: "אינטגרציות",
    description: "Email, Google Calendar, Facebook Ads, Webhooks",
    icon: Webhook,
    path: "/settings/integrations",
    color: "bg-purple-50 text-purple-500",
  },
  {
    title: "טפסי לידים",
    description: "בניית טפסים לאיסוף לידים אוטומטית",
    icon: FileText,
    path: "/settings/forms",
    color: "bg-green-50 text-green-500",
  },
  {
    title: "תבניות חוזים",
    description: "ניהול תבניות HTML לחוזים וחתימה דיגיטלית",
    icon: FileSignature,
    path: "/settings/contracts",
    color: "bg-indigo-50 text-indigo-500",
  },
  {
    title: "חשבון פייסבוק",
    description: "חיבור Facebook Ads API לסנכרון קמפיינים",
    icon: Target,
    path: "/settings/ads",
    color: "bg-sky-50 text-sky-500",
  },
  {
    title: "ייבוא מ-Fireberry",
    description: "העברת נתונים מפיירברי ל-CRM",
    icon: Upload,
    path: "/settings/migration",
    color: "bg-orange-50 text-orange-500",
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted-foreground text-sm">ניהול הגדרות המערכת</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => (
          <button
            key={section.path}
            onClick={() => navigate(section.path)}
            className="p-6 bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/20 transition-all text-right"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2.5 rounded-xl ${section.color}`}>
                <section.icon size={22} />
              </div>
              <h3 className="font-semibold text-lg">{section.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
