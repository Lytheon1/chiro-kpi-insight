import * as XLSX from "xlsx";

/** Lowercase, trim, collapse spaces */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Convert an Excel serial date number or date string to ISO yyyy-mm-dd.
 * ChiroTouch exports use Excel 1900 date system.
 */
export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Already a string date like "10/01/25" or "2025-10-01"
  if (typeof value === "string") {
    const s = value.trim();
    // MM/DD/YY
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m1) {
      const yr = parseInt(m1[3]) + 2000;
      return `${yr}-${m1[1].padStart(2,"0")}-${m1[2].padStart(2,"0")}`;
    }
    // MM/DD/YYYY
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) {
      return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
    }
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }

  // Excel serial number (e.g., 45931.208...)
  if (typeof value === "number" && value > 1000) {
    const parsed = XLSX.SSF.parse_date_code(Math.floor(value));
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;
  }

  return null;
}

/** Convert Excel serial time or time string to HH:MM */
export function normalizeTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  if (typeof value === "number" && value > 0 && value < 1) {
    // Fractional day
    const totalMinutes = Math.round(value * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  if (typeof value === "number" && value > 1000) {
    // Excel serial for time-of-day embedded in full datetime
    const frac = value - Math.floor(value);
    return normalizeTime(frac);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

/** Case-insensitive substring search */
export function containsAny(haystack: string, needles: string[]): boolean {
  const h = normalizeText(haystack);
  return needles.some((n) => h.includes(n.toLowerCase().trim()));
}

/** Safe number extraction */
export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}
