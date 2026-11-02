import type { Task } from "./types.ts";

/**
 * All business dates are interpreted in Asia/Shanghai (UTC+8, no DST).
 * A date-only deadline is due at the END of that day (23:59:59.999).
 */
export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiNow(now: Date = new Date()): {
  date: string;
  time: string;
  timestamp: number;
} {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const iso = shifted.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    timestamp: now.getTime(),
  };
}

export function formatShanghai(now: Date = new Date()): string {
  const { date, time } = shanghaiNow(now);
  return `${date} ${time}`;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isValidTime(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Due timestamp in epoch ms; date-only means the end of that Beijing day. */
export function dueTimestamp(dueDate: string, dueTime: string): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  if (dueTime === "") {
    return Date.UTC(y, m - 1, d, 23, 59, 59, 999) - SHANGHAI_OFFSET_MS;
  }
  const [h, min] = dueTime.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, min, 0, 0) - SHANGHAI_OFFSET_MS;
}

export function isActive(task: Task): boolean {
  return task.status === "todo";
}

export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status !== "todo") return false; // done/archived are never overdue
  return dueTimestamp(task.dueDate, task.dueTime) < now.getTime();
}

export function isDueToday(task: Task, now: Date = new Date()): boolean {
  return task.dueDate === shanghaiNow(now).date && task.status !== "archived";
}

export function daysUntil(dueDate: string, now: Date = new Date()): number {
  const { date } = shanghaiNow(now);
  const [y1, m1, d1] = date.split("-").map(Number);
  const [y2, m2, d2] = dueDate.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}
