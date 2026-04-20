import { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, Plus, Calendar as CalIcon, Clock, Phone, Mail, CheckSquare, Users } from "lucide-react";
import { useTasks, useCreateTask } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TASK_TYPES, TASK_PRIORITIES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const TYPE_COLORS: Record<string, string> = {
  task: "bg-blue-500", call: "bg-green-500", meeting: "bg-purple-500",
  follow_up: "bg-orange-500", email: "bg-cyan-500",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", type: "meeting", priority: "medium", due_date: "" });

  const { data: tasks } = useTasks();
  const createTask = useCreateTask();

  const { year, month } = currentDate;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Get current week dates for week view
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }, []);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    tasks?.forEach(t => {
      if (!t.due_date) return;
      const key = t.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key]!.push(t);
    });
    return map;
  }, [tasks]);

  const prevMonth = () => setCurrentDate(d => d.month === 0 ? { year: d.year - 1, month: 11 } : { ...d, month: d.month - 1 });
  const nextMonth = () => setCurrentDate(d => d.month === 11 ? { year: d.year + 1, month: 0 } : { ...d, month: d.month + 1 });
  const goToday = () => setCurrentDate({ year: today.getFullYear(), month: today.getMonth() });

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.due_date) return;
    createTask.mutate({
      title: newTask.title,
      type: newTask.type as any,
      priority: newTask.priority as any,
      due_date: new Date(newTask.due_date).toISOString(),
      status: "pending",
    } as any);
    setShowForm(false);
    setNewTask({ title: "", type: "meeting", priority: "medium", due_date: "" });
  };

  const openNewOnDate = (dateStr: string) => {
    setNewTask(t => ({ ...t, due_date: dateStr }));
    setShowForm(true);
  };

  // Build month grid cells
  const cells: { date: number; dateStr: string; isToday: boolean; isCurrentMonth: boolean }[] = [];
  // Previous month padding
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ date: d, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isToday: false, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: d, dateStr, isToday: dateStr === todayStr, isCurrentMonth: true });
  }
  // Next month padding
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    cells.push({ date: d, dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isToday: false, isCurrentMonth: false });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">לוח שנה</h1>
          <p className="text-muted-foreground text-sm">
            {tasks?.filter(t => t.status !== "completed" && t.status !== "cancelled").length || 0} משימות פתוחות
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView("month")} className={cn("px-3 py-1.5 text-xs font-medium", view === "month" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>
              חודש
            </button>
            <button onClick={() => setView("week")} className={cn("px-3 py-1.5 text-xs font-medium", view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>
              שבוע
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90">
            <Plus size={16} />
            אירוע חדש
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary"><ChevronRight size={18} /></button>
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-bold">{MONTHS_HE[month]} {year}</h2>
        </div>
        <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary">
          היום
        </button>
      </div>

      {/* Month View */}
      {view === "month" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS_HE.map(day => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const dayTasks = tasksByDate[cell.dateStr] || [];
              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[100px] p-1.5 border-b border-l border-border cursor-pointer hover:bg-muted/30 transition-colors",
                    !cell.isCurrentMonth && "bg-muted/10 text-muted-foreground/40",
                    cell.isToday && "bg-primary/5",
                    selectedDate === cell.dateStr && "ring-2 ring-primary/30 ring-inset",
                  )}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  onDoubleClick={() => openNewOnDate(cell.dateStr)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      cell.isToday && "bg-primary text-primary-foreground"
                    )}>
                      {cell.date}
                    </span>
                    {dayTasks.length > 0 && cell.isCurrentMonth && (
                      <span className="text-[10px] text-muted-foreground">{dayTasks.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] bg-secondary/60 truncate">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", TYPE_COLORS[task.type] || "bg-gray-400")} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} עוד</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {view === "week" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7">
            {weekDates.map((date, i) => {
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const dayTasks = tasksByDate[dateStr] || [];
              const isToday = dateStr === todayStr;

              return (
                <div key={i} className={cn("border-l border-border first:border-l-0 min-h-[350px]", isToday && "bg-primary/3")}>
                  {/* Day header */}
                  <div className="px-3 py-2 border-b border-border text-center">
                    <p className="text-[10px] text-muted-foreground">{DAYS_HE[i]}</p>
                    <p className={cn(
                      "text-lg font-bold w-9 h-9 flex items-center justify-center rounded-full mx-auto",
                      isToday && "bg-primary text-primary-foreground"
                    )}>
                      {date.getDate()}
                    </p>
                  </div>

                  {/* Tasks */}
                  <div className="p-2 space-y-1.5">
                    {dayTasks.map(task => {
                      const time = task.due_date ? new Date(task.due_date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
                      return (
                        <div key={task.id} className={cn(
                          "p-2 rounded-lg border text-[11px]",
                          task.status === "completed" ? "border-gray-200 bg-gray-50 line-through text-gray-400" : "border-border bg-white hover:shadow-sm"
                        )}>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", TYPE_COLORS[task.type] || "bg-gray-400")} />
                            <span className="font-medium truncate">{task.title}</span>
                          </div>
                          {time && <p className="text-muted-foreground text-[10px]">{time}</p>}
                        </div>
                      );
                    })}

                    {/* Add button */}
                    <button
                      onClick={() => openNewOnDate(dateStr)}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                      <Plus size={10} /> הוסף
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} dir="rtl">
            <h2 className="text-lg font-semibold">אירוע חדש</h2>
            <div>
              <label className="text-sm font-medium mb-1 block">כותרת *</label>
              <input value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background outline-none focus:ring-2 focus:ring-ring" placeholder="פגישה עם..." autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">סוג</label>
                <Select value={newTask.type} onValueChange={v => setNewTask(t => ({ ...t, type: v }))}>
                  <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                    <SelectValue placeholder="בחר סוג" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">עדיפות</label>
                <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v }))}>
                  <SelectTrigger className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
                    <SelectValue placeholder="בחר עדיפות" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תאריך ושעה *</label>
              <DateTimePicker value={newTask.due_date} onChange={v => setNewTask(t => ({ ...t, due_date: v }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreateTask} disabled={!newTask.title || !newTask.due_date}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                צור אירוע
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
