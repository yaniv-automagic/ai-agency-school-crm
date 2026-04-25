import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  ChevronRight,
  ChevronLeft,
  Package,
  Zap,
  Megaphone,
  Video,
  GraduationCap,
  FileSignature,
  Radio,
  DollarSign,
  BookOpen,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "דשבורד" },
  { to: "/contacts", icon: Users, label: "לידים" },
  { to: "/meetings", icon: Video, label: "פגישות" },
  { to: "/tasks", icon: CheckSquare, label: "משימות" },
  { to: "/enrollments", icon: GraduationCap, label: "תלמידים" },
  { to: "/workshops", icon: BookOpen, label: "סדנאות" },
  { to: "/contracts", icon: FileSignature, label: "חוזים" },
  { to: "/finance", icon: DollarSign, label: "פיננסים" },
  { to: "/events", icon: Radio, label: "אירועים" },
  { to: "/campaigns", icon: Megaphone, label: "קמפיינים" },
  { to: "/automations", icon: Zap, label: "אוטומציות" },
  { to: "/products", icon: Package, label: "מוצרים" },
  { to: "/settings", icon: Settings, label: "הגדרות" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-l border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="AI Agency" className="w-8 h-8 rounded-lg shrink-0" />
            <h1 className="text-lg font-bold text-sidebar-primary-foreground truncate">
              AI Agency CRM
            </h1>
          </div>
        ) : (
          <img src="/logo.png" alt="AI Agency" className="w-8 h-8 rounded-lg" />
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )
            }
          >
            <Icon size={20} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/50 text-center">
            AI Agency School CRM v0.1
          </p>
        )}
      </div>
    </aside>
  );
}
