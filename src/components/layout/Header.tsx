import { Search, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CommandPalette from "@/components/shared/CommandPalette";
import NotificationCenter from "./NotificationCenter";
import TodaySchedule from "./TodaySchedule";
import TodayTasks from "./TodayTasks";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export default function Header() {
  const navigate = useNavigate();
  const { user, teamMember, signOut } = useAuth();
  const [cmdOpen, setCmdOpen] = useState(false);

  useKeyboardShortcuts(() => setCmdOpen(true));
  useRealtimeSubscription();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setCmdOpen(false); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        {/* Search */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors min-w-[240px]"
          >
            <Search size={16} />
            <span>חיפוש...</span>
            <kbd className="mr-auto text-xs bg-background px-1.5 py-0.5 rounded border">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <TodaySchedule />
          <TodayTasks />
          <NotificationCenter />

          {/* User menu */}
          <div className="flex items-center gap-2 border-r border-border pr-3 mr-1">
            {teamMember?.avatar_url ? (
              <img
                src={teamMember.avatar_url}
                alt={teamMember.display_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                {teamMember?.display_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
            )}
            <div className="hidden md:block">
              <p className="text-sm font-medium leading-tight">
                {teamMember?.display_name || user?.email}
              </p>
              {teamMember?.role && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {teamMember.role === "owner" ? "בעלים" : teamMember.role}
                </p>
              )}
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
              title="התנתק"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}
