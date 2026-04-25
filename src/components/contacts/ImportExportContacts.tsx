import { useState, useRef } from "react";
import { Download, Upload, X, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Contact } from "@/types/crm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ImportExportProps {
  contacts: Contact[];
}

export function ExportButton({ contacts }: ImportExportProps) {
  const handleExport = () => {
    if (!contacts.length) {
      toast.error("אין לידים לייצוא");
      return;
    }

    const exportData = contacts.map(c => ({
      "שם פרטי": c.first_name,
      "שם משפחה": c.last_name,
      "מייל": c.email || "",
      "טלפון": c.phone || "",
      "חברה": c.company || "",
      "תפקיד": c.job_title || "",
      "עיר": c.city || "",
      "סטטוס": c.status,
      "מקור": c.source,
      "תגיות": c.tags?.join(", ") || "",
      "הערות": c.notes || "",
      "תאריך יצירה": new Date(c.created_at).toLocaleDateString("he-IL"),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "לידים");
    XLSX.writeFile(wb, `crm_contacts_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${contacts.length} לידים יוצאו בהצלחה`);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors"
    >
      <Download size={14} />
      ייצוא
    </button>
  );
}

export function ImportButton() {
  const [showModal, setShowModal] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const crmFields = [
    { key: "first_name", label: "שם פרטי" },
    { key: "last_name", label: "שם משפחה" },
    { key: "email", label: "מייל" },
    { key: "phone", label: "טלפון" },
    { key: "company", label: "חברה" },
    { key: "job_title", label: "תפקיד" },
    { key: "city", label: "עיר" },
    { key: "notes", label: "הערות" },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      if (json.length === 0) {
        toast.error("הקובץ ריק");
        return;
      }

      setPreview(json);
      setShowModal(true);

      // Auto-map columns
      const cols = Object.keys(json[0]);
      const autoMap: Record<string, string> = {};
      const mappings: Record<string, string[]> = {
        first_name: ["שם פרטי", "first name", "firstname", "first_name", "שם"],
        last_name: ["שם משפחה", "last name", "lastname", "last_name", "משפחה"],
        email: ["מייל", "email", "אימייל", "דוא\"ל"],
        phone: ["טלפון", "phone", "tel", "telephone", "נייד", "mobile", "whatsapp", "וואטסאפ"],
        company: ["חברה", "company", "ארגון", "organization"],
        job_title: ["תפקיד", "title", "job title", "job_title", "role"],
        city: ["עיר", "city"],
        notes: ["הערות", "notes", "note"],
      };

      for (const col of cols) {
        const lower = col.toLowerCase().trim();
        for (const [field, aliases] of Object.entries(mappings)) {
          if (aliases.some(a => lower.includes(a.toLowerCase()))) {
            autoMap[field] = col;
            break;
          }
        }
      }
      setMapping(autoMap);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!mapping.first_name || !mapping.last_name) {
      toast.error("יש למפות לפחות שם פרטי ושם משפחה");
      return;
    }

    setImporting(true);
    const contacts = preview.map(row => {
      const contact: Record<string, any> = { source: "import", status: "new" };
      for (const [crmField, csvCol] of Object.entries(mapping)) {
        if (csvCol && row[csvCol]) {
          contact[crmField] = row[csvCol];
        }
      }
      return contact;
    }).filter(c => c.first_name && c.last_name);

    const { error } = await supabase.from("crm_contacts").insert(contacts);
    setImporting(false);

    if (error) {
      toast.error(`שגיאה בייבוא: ${error.message}`);
    } else {
      toast.success(`${contacts.length} לידים יובאו בהצלחה`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setShowModal(false);
      setPreview([]);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-lg hover:bg-secondary transition-colors"
      >
        <Upload size={14} />
        ייבוא
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                <FileSpreadsheet size={20} className="inline ml-2" />
                ייבוא {preview.length} לידים
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-secondary">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              מפה את העמודות מהקובץ לשדות ב-CRM:
            </p>

            <div className="space-y-3 mb-6">
              {crmFields.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-24 shrink-0">{label}</span>
                  <span className="text-muted-foreground">←</span>
                  <Select
                    value={mapping[key] || "__none__"}
                    onValueChange={(val) => setMapping(m => ({ ...m, [key]: val === "__none__" ? "" : val }))}
                  >
                    <SelectTrigger className="flex-1 px-3 py-1.5 text-sm border border-input rounded-lg bg-background">
                      <SelectValue placeholder="-- לא למפות --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- לא למפות --</SelectItem>
                      {Object.keys(preview[0] || {}).map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="border border-border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {Object.keys(preview[0] || {}).slice(0, 5).map(col => (
                      <th key={col} className="text-center px-3 py-2 font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {Object.keys(preview[0] || {}).slice(0, 5).map(col => (
                        <td key={col} className="px-3 py-2 text-muted-foreground">{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing || !mapping.first_name || !mapping.last_name}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? "מייבא..." : `ייבוא ${preview.length} לידים`}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
