/**
 * Keyword parsing and matching helpers.
 * Shared across all keyword input UIs and KPI calculation logic.
 */

export function parseCommaSeparatedKeywords(input: string): string[] {
  return input
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesAnyKeyword(value: string, keywords: string[]): boolean {
  const normalized = value.trim().toLowerCase();
  return keywords.some(k => normalized.includes(k));
}

/** localStorage key for persisted keyword filters */
export const KEYWORDS_STORAGE_KEY = 'ctc-kpi-keyword-filters';

export function saveFiltersToStorage(filters: Record<string, any>) {
  try {
    localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(filters));
  } catch { /* ignore */ }
}

export function loadFiltersFromStorage(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(KEYWORDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearFiltersFromStorage() {
  try {
    localStorage.removeItem(KEYWORDS_STORAGE_KEY);
  } catch { /* ignore */ }
}
