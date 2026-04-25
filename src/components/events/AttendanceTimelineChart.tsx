import { useMemo } from "react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Users, TrendingUp, TrendingDown, Clock } from "lucide-react";

export interface AttendanceSession {
  joined_at: string;  // ISO timestamp
  left_at: string;
  duration_seconds: number;
}

interface Props {
  sessions: AttendanceSession[];
  eventStart: string;            // ISO timestamp
  eventEnd?: string | null;
  durationMinutes: number;
}

interface SweepPoint { ts: number; count: number; }

function buildTimeline(sessions: AttendanceSession[], startMs: number, endMs: number): SweepPoint[] {
  // Sweep-line: emit +1 at each join_at and -1 at each left_at, sort, accumulate
  const events: { t: number; delta: number }[] = [];
  for (const s of sessions) {
    const j = +new Date(s.joined_at);
    const l = +new Date(s.left_at);
    if (isNaN(j) || isNaN(l) || l <= j) continue;
    events.push({ t: j, delta: +1 });
    events.push({ t: l, delta: -1 });
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const points: SweepPoint[] = [{ ts: startMs, count: 0 }];
  let count = 0;
  for (const e of events) {
    // Step "before": add a point at the same time with the previous count to render a vertical step
    if (e.t >= startMs && e.t <= endMs) {
      points.push({ ts: e.t, count });
      count += e.delta;
      points.push({ ts: e.t, count });
    } else {
      count += e.delta;
    }
  }
  points.push({ ts: endMs, count });
  return points;
}

function formatHHMM(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function AttendanceTimelineChart({ sessions, eventStart, eventEnd, durationMinutes }: Props) {
  const { points, peak, peakAt, avg, dropOff, totalUnique } = useMemo(() => {
    const startMs = +new Date(eventStart);
    const endMs = eventEnd ? +new Date(eventEnd) : startMs + durationMinutes * 60_000;
    const pts = buildTimeline(sessions, startMs, endMs);

    let peak = 0, peakAt = startMs, sumWeighted = 0, totalDur = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const c = pts[i].count;
      const dur = pts[i + 1].ts - pts[i].ts;
      if (c > peak) { peak = c; peakAt = pts[i].ts; }
      sumWeighted += c * dur;
      totalDur += dur;
    }
    const avg = totalDur > 0 ? sumWeighted / totalDur : 0;

    // Drop-off: peak count vs final 10% window count
    const tail = pts.filter(p => p.ts >= endMs - (endMs - startMs) * 0.1);
    const tailMax = tail.reduce((m, p) => Math.max(m, p.count), 0);
    const dropOff = peak > 0 ? (peak - tailMax) / peak : 0;

    const totalUnique = new Set(sessions.map(s => `${s.joined_at}|${s.duration_seconds}`)).size;

    return { points: pts, peak, peakAt, avg, dropOff, totalUnique };
  }, [sessions, eventStart, eventEnd, durationMinutes]);

  if (sessions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-blue-500" />
          <h3 className="font-semibold">גרף נוכחות</h3>
        </div>
        <div className="text-center py-12 text-muted-foreground/60 italic text-sm">
          אין נתוני נוכחות עדיין. הרץ סנכרון מ-Zoom להציג גרף.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-blue-500" />
          <h3 className="font-semibold">גרף נוכחות</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">Zoom</span>
        </div>
        <div className="flex gap-3 text-xs">
          <Stat label="שיא" value={`${peak}`} icon={<TrendingUp size={11} />} time={formatHHMM(peakAt)} color="text-emerald-600" />
          <Stat label="ממוצע" value={avg.toFixed(1)} icon={<Users size={11} />} color="text-blue-600" />
          <Stat label="נטישה" value={`${Math.round(dropOff * 100)}%`} icon={<TrendingDown size={11} />} color="text-amber-600" />
          <Stat label="סה״כ" value={`${totalUnique}`} icon={<Clock size={11} />} color="text-muted-foreground" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatHHMM}
            tick={{ fontSize: 11 }}
            scale="time"
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            labelFormatter={(t) => formatHHMM(t as number)}
            formatter={(v: any) => [v, "נוכחים"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine y={peak} stroke="#10b981" strokeDasharray="3 3" label={{ value: `שיא ${peak}`, fontSize: 10, fill: "#10b981", position: "insideTopRight" }} />
          <Area
            type="stepAfter"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#attendanceGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Stat({ label, value, icon, time, color }: { label: string; value: string; icon: React.ReactNode; time?: string; color: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className={`flex items-center gap-1 font-bold ${color}`}>
        {icon}
        <span>{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{label}{time ? ` · ${time}` : ""}</span>
    </div>
  );
}
