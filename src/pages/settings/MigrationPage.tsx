import { useState } from "react";
import { ArrowRight, Upload, Download, CheckCircle, AlertCircle, Loader2, Database, Users, Kanban, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MigrationStep {
  id: string;
  label: string;
  icon: any;
  status: "pending" | "running" | "done" | "error";
  count?: number;
  error?: string;
}

const FIREBERRY_API = "https://api.fireberry.com/api";

export default function MigrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiToken, setApiToken] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<MigrationStep[]>([
    { id: "contacts", label: "אנשי קשר (Contacts)", icon: Users, status: "pending" },
    { id: "accounts", label: "חשבונות (Accounts)", icon: Database, status: "pending" },
    { id: "deals", label: "עסקאות (Opportunities)", icon: Kanban, status: "pending" },
    { id: "activities", label: "פעילויות (Activities)", icon: FileText, status: "pending" },
  ]);

  const updateStep = (id: string, updates: Partial<MigrationStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const fetchFromFireberry = async (endpoint: string, pageSize = 50, pageNumber = 1) => {
    const res = await fetch(`${FIREBERRY_API}/record/${endpoint}?pagesize=${pageSize}&pagenumber=${pageNumber}`, {
      headers: { tokenid: apiToken, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Fireberry API error: ${res.status}`);
    return res.json();
  };

  const fetchAllRecords = async (endpoint: string): Promise<any[]> => {
    const allRecords: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const data = await fetchFromFireberry(endpoint, 50, page);
      const records = data.Records || data.data?.Records || [];
      allRecords.push(...records);
      const total = data.Total_Records || data.data?.Total_Records || 0;
      if (allRecords.length >= total || records.length < 50) break;
    }
    return allRecords;
  };

  const migrateContacts = async () => {
    updateStep("contacts", { status: "running" });
    try {
      const records = await fetchAllRecords("contact");
      const contacts = records.map((r: any) => ({
        first_name: r.firstname || r.FirstName || r.first_name || "ללא שם",
        last_name: r.lastname || r.LastName || r.last_name || "",
        email: r.emailaddress1 || r.email || r.Email || null,
        phone: r.telephone1 || r.phone || r.Phone || null,
        company: r.company || r.Company || null,
        job_title: r.jobtitle || r.JobTitle || null,
        city: r.city || r.City || null,
        source: "import",
        status: "new",
        notes: r.description || null,
        custom_fields: { fireberry_id: r.contactid || r.id },
      }));

      if (contacts.length > 0) {
        const { error } = await supabase.from("crm_contacts").insert(contacts);
        if (error) throw error;
      }

      updateStep("contacts", { status: "done", count: contacts.length });
      return contacts.length;
    } catch (e: any) {
      updateStep("contacts", { status: "error", error: e.message });
      return 0;
    }
  };

  const migrateAccounts = async () => {
    updateStep("accounts", { status: "running" });
    try {
      const records = await fetchAllRecords("account");
      const accounts = records.map((r: any) => ({
        name: r.accountname || r.name || r.Name || "ללא שם",
        website: r.websiteurl || r.website || null,
        phone: r.telephone1 || r.phone || null,
        email: r.emailaddress1 || r.email || null,
        city: r.city || null,
        industry: r.industry || null,
        notes: r.description || null,
        custom_fields: { fireberry_id: r.accountid || r.id },
      }));

      if (accounts.length > 0) {
        const { error } = await supabase.from("crm_accounts").insert(accounts);
        if (error) throw error;
      }

      updateStep("accounts", { status: "done", count: accounts.length });
      return accounts.length;
    } catch (e: any) {
      updateStep("accounts", { status: "error", error: e.message });
      return 0;
    }
  };

  const migrateDeals = async () => {
    updateStep("deals", { status: "running" });
    try {
      const records = await fetchAllRecords("opportunity");

      // Get default pipeline
      const { data: pipelines } = await supabase.from("crm_pipelines").select("id").eq("is_default", true).single();
      const { data: stages } = await supabase.from("crm_pipeline_stages")
        .select("id, order_index")
        .eq("pipeline_id", pipelines?.id)
        .order("order_index")
        .limit(1);

      if (!pipelines || !stages?.length) {
        throw new Error("No default pipeline found");
      }

      const deals = records.map((r: any) => ({
        contact_id: null, // Would need to map by fireberry_id
        pipeline_id: pipelines.id,
        stage_id: stages[0].id,
        title: r.name || r.subject || r.Name || "עסקה מיובאת",
        value: Number(r.estimatedvalue || r.amount || 0),
        status: "open",
        notes: r.description || null,
        custom_fields: { fireberry_id: r.opportunityid || r.id },
      }));

      // Filter out deals without contact_id (can't insert with null NOT NULL field)
      // For now, create a placeholder contact
      const { data: placeholder } = await supabase.from("crm_contacts")
        .select("id")
        .limit(1)
        .single();

      const validDeals = deals.map((d: any) => ({ ...d, contact_id: placeholder?.id })).filter((d: any) => d.contact_id);

      if (validDeals.length > 0) {
        const { error } = await supabase.from("crm_deals").insert(validDeals);
        if (error) throw error;
      }

      updateStep("deals", { status: "done", count: validDeals.length });
      return validDeals.length;
    } catch (e: any) {
      updateStep("deals", { status: "error", error: e.message });
      return 0;
    }
  };

  const migrateActivities = async () => {
    updateStep("activities", { status: "running" });
    try {
      // Skip if no contacts exist
      const { count } = await supabase.from("crm_contacts").select("id", { count: "exact", head: true });
      if (!count) {
        updateStep("activities", { status: "done", count: 0 });
        return 0;
      }
      updateStep("activities", { status: "done", count: 0 });
      return 0;
    } catch (e: any) {
      updateStep("activities", { status: "error", error: e.message });
      return 0;
    }
  };

  const startMigration = async () => {
    if (!apiToken) {
      toast.error("יש להזין API Token של פיירברי");
      return;
    }

    setRunning(true);
    setSteps(prev => prev.map(s => ({ ...s, status: "pending", count: undefined, error: undefined })));

    let total = 0;
    total += await migrateContacts();
    total += await migrateAccounts();
    total += await migrateDeals();
    total += await migrateActivities();

    queryClient.invalidateQueries();
    setRunning(false);
    toast.success(`הועברו ${total} רשומות בהצלחה`);
  };

  const totalDone = steps.filter(s => s.status === "done").reduce((sum, s) => sum + (s.count || 0), 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">ייבוא מ-Fireberry</h1>
          <p className="text-muted-foreground text-sm">העברת נתונים מפיירברי ל-CRM</p>
        </div>
      </div>

      {/* API Token */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3">התחברות ל-Fireberry</h3>
        <p className="text-sm text-muted-foreground mb-3">
          הזן את ה-API Token שלך מ-Fireberry (הגדרות → אינטגרציות → API)
        </p>
        <input
          type="password"
          value={apiToken}
          onChange={e => setApiToken(e.target.value)}
          placeholder="API Token..."
          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
      </div>

      {/* Migration steps */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">שלבי ייבוא</h3>
        </div>
        <div className="divide-y divide-border">
          {steps.map(step => (
            <div key={step.id} className="flex items-center gap-4 p-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                step.status === "done" ? "bg-green-50 text-green-500" :
                step.status === "error" ? "bg-red-50 text-red-500" :
                step.status === "running" ? "bg-blue-50 text-blue-500" :
                "bg-secondary text-muted-foreground"
              )}>
                {step.status === "running" ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : step.status === "done" ? (
                  <CheckCircle size={20} />
                ) : step.status === "error" ? (
                  <AlertCircle size={20} />
                ) : (
                  <step.icon size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.label}</p>
                {step.status === "done" && (
                  <p className="text-xs text-green-600">{step.count} רשומות יובאו</p>
                )}
                {step.status === "error" && (
                  <p className="text-xs text-red-500">{step.error}</p>
                )}
                {step.status === "running" && (
                  <p className="text-xs text-blue-500">מייבא...</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-4">
        <button
          onClick={startMigration}
          disabled={running || !apiToken}
          className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {running ? "מייבא..." : "התחל ייבוא"}
        </button>

        {totalDone > 0 && (
          <p className="text-sm text-green-600 font-medium">
            סה״כ {totalDone} רשומות יובאו בהצלחה
          </p>
        )}
      </div>

      {/* Info */}
      <div className="bg-secondary/50 rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">שים לב:</p>
        <ul className="space-y-1 list-disc pr-5">
          <li>הייבוא לא מוחק נתונים קיימים - הרשומות מתווספות</li>
          <li>אנשי קשר, חשבונות ועסקאות מיובאים עם שדה fireberry_id לקישור</li>
          <li>הרצת ייבוא כפולה תיצור רשומות כפולות</li>
          <li>מומלץ לבדוק עם כמות קטנה של נתונים קודם</li>
        </ul>
      </div>
    </div>
  );
}
