import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Users, Building2, CheckSquare, Settings,
  LayoutDashboard, Plus, Search
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Contact } from "@/types/crm";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setContacts([]);
      return;
    }
    // Load recent contacts
    supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, email, status")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setContacts(data as Contact[]);
      });
  }, [open]);

  useEffect(() => {
    if (!search || search.length < 2) return;
    const timer = setTimeout(() => {
      supabase
        .from("crm_contacts")
        .select("id, first_name, last_name, email, status")
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(8)
        .then(({ data }) => {
          if (data) setContacts(data as Contact[]);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          dir="rtl"
        >
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="חפש לידים, עמודים..."
              className="flex-1 py-4 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              לא נמצאו תוצאות
            </Command.Empty>

            <Command.Group heading="ניווט מהיר" className="text-xs text-muted-foreground px-2 py-1.5">
              {[
                { label: "דשבורד", icon: LayoutDashboard, path: "/" },
                { label: "לידים", icon: Users, path: "/contacts" },
                { label: "חשבונות", icon: Building2, path: "/accounts" },
                { label: "משימות", icon: CheckSquare, path: "/tasks" },
                { label: "הגדרות", icon: Settings, path: "/settings" },
              ].map(({ label, icon: Icon, path }) => (
                <Command.Item
                  key={path}
                  value={label}
                  onSelect={() => go(path)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer data-[selected=true]:bg-secondary"
                >
                  <Icon size={16} className="text-muted-foreground shrink-0" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="פעולות" className="text-xs text-muted-foreground px-2 py-1.5">
              <Command.Item
                value="ליד חדש"
                onSelect={() => go("/contacts?new=true")}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer data-[selected=true]:bg-secondary"
              >
                <Plus size={16} className="text-primary shrink-0" />
                ליד חדש
              </Command.Item>
            </Command.Group>

            {contacts.length > 0 && (
              <Command.Group heading="לידים" className="text-xs text-muted-foreground px-2 py-1.5">
                {contacts.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`${c.first_name} ${c.last_name} ${c.email}`}
                    onSelect={() => go(`/contacts/${c.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer data-[selected=true]:bg-secondary"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                      {c.first_name?.charAt(0)}{c.last_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{c.first_name} {c.last_name}</span>
                      {c.email && (
                        <span className="text-muted-foreground mr-2 text-xs">{c.email}</span>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
