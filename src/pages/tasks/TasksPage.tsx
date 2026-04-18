import { useState } from "react";
import { Plus, CheckSquare, Clock, AlertTriangle, Calendar } from "lucide-react";
import { useTasks, useCreateTask, useCompleteTask } from "@/hooks/useTasks";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";

export default function TasksPage() {
  const [filter, setFilter] = useState<"all" | "pending" | "overdue">("all");
  const [showForm, setShowForm] = useState(false);
  const { data: tasks, isLoading } = useTasks();
  const completeTask = useCompleteTask();
  const createTask = useCreateTask();

  const now = new Date();
  const filteredTasks = tasks?.filter(task => {
    if (filter === "pending") return task.status === "pending" || task.status === "in_progress";
    if (filter === "overdue") return task.due_date && new Date(task.due_date) < now && task.status !== "completed";
    return task.status !== "completed" && task.status !== "cancelled";
  }) || [];

  const overdueTasks = tasks?.filter(t =>
    t.due_date && new Date(t.due_date) < now && t.status !== "completed" && t.status !== "cancelled"
  ).length || 0;

  const [newTask, setNewTask] = useState({ title: "", type: "task", priority: "medium", due_date: "" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">משימות</h1>
          <p className="text-muted-foreground text-sm">
            {filteredTasks.length} משימות
            {overdueTasks > 0 && (
              <span className="text-destructive"> | {overdueTasks} באיחור</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          משימה חדשה
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        {[
          { key: "all", label: "הכל", icon: CheckSquare },
          { key: "pending", label: "ממתינות", icon: Clock },
          { key: "overdue", label: "באיחור", icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors",
              filter === key ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-2">
          {filteredTasks.map(task => {
            const priority = TASK_PRIORITIES.find(p => p.value === task.priority);
            const taskType = TASK_TYPES.find(t => t.value === task.type);
            const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== "completed";

            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-4 p-4 bg-card border rounded-xl transition-colors",
                  isOverdue ? "border-destructive/30" : "border-border"
                )}
              >
                <button
                  onClick={() => completeTask.mutate(task.id)}
                  className="w-5 h-5 rounded border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 transition-colors shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {taskType && (
                      <span className="text-xs text-muted-foreground">{taskType.label}</span>
                    )}
                    {task.contact && (
                      <span className="text-xs text-muted-foreground">
                        {task.contact.first_name} {task.contact.last_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium", priority?.color)}>
                    {priority?.label}
                  </span>
                  {task.due_date && (
                    <span className={cn(
                      "flex items-center gap-1 text-xs",
                      isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                    )}>
                      <Calendar size={12} />
                      {new Date(task.due_date).toLocaleDateString("he-IL")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <CheckSquare size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium mb-1">אין משימות</p>
            <p className="text-sm">הכל טופל!</p>
          </div>
        </div>
      )}

      {/* Quick Add Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">משימה חדשה</h2>
            <div>
              <label className="text-sm font-medium mb-1 block">כותרת *</label>
              <input
                value={newTask.title}
                onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="מה צריך לעשות?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">סוג</label>
                <select
                  value={newTask.type}
                  onChange={e => setNewTask(t => ({ ...t, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                >
                  {TASK_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">עדיפות</label>
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
                >
                  {TASK_PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תאריך יעד</label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (!newTask.title) return;
                  createTask.mutate({
                    title: newTask.title,
                    type: newTask.type as any,
                    priority: newTask.priority as any,
                    due_date: newTask.due_date || null,
                    status: "pending",
                  } as any);
                  setShowForm(false);
                  setNewTask({ title: "", type: "task", priority: "medium", due_date: "" });
                }}
                disabled={!newTask.title}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                צור משימה
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
