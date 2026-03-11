/**
 * Returns the ISO week label for a date string (yyyy-mm-dd).
 * Format: "YYYY-WNN" (e.g., "2025-W41")
 */
export function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function groupByWeek<T>(
  items: T[],
  getDate: (item: T) => string,
  getValue: (item: T) => number
): Array<{ week: string; value: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = getDate(item);
    if (!d) continue;
    const week = getWeekLabel(d);
    map.set(week, (map.get(week) ?? 0) + getValue(item));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, value]) => ({ week, value }));
}
