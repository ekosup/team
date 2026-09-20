import type { Task } from "../types";

const DAY = 86_400_000;

const fmtDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const fmtDateShort = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const fmtDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** SQLite datetime('now') is UTC without a zone marker. */
export function parseDbDate(s: string) {
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

export function formatDateTime(s: string) {
  return fmtDateTime.format(parseDbDate(s));
}

export function formatRange(start: string | null, end: string | null) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (s && e) {
    const sameYear = s.getFullYear() === e.getFullYear();
    return `${(sameYear ? fmtDateShort : fmtDate).format(s)} – ${fmtDate.format(e)}`;
  }
  if (s) return `Mulai ${fmtDate.format(s)}`;
  if (e) return `Sampai ${fmtDate.format(e)}`;
  return "";
}

export type TaskFlags = {
  /** days past timeline_end; 0 when not overdue */
  overdueDays: number;
  /** ends within 3 days */
  dueSoon: boolean;
  blocked: boolean;
  high: boolean;
};

export function taskFlags(task: Task, done: boolean, now = new Date()): TaskFlags {
  const blocked = !!task.blocked_reason;
  const high = task.priority === "high";
  if (done || !task.timeline_end) return { overdueDays: 0, dueSoon: false, blocked, high };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(task.timeline_end);
  const diff = Math.round((end.getTime() - today.getTime()) / DAY);
  return { overdueDays: diff < 0 ? -diff : 0, dueSoon: diff >= 0 && diff <= 3, blocked, high };
}

export function needsAttention(f: TaskFlags) {
  return f.overdueDays > 0 || f.blocked || f.high;
}
