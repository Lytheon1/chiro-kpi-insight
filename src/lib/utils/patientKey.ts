/**
 * Normalizes patient names for cross-report matching.
 * Handles cases like "Grant, Jennifer A." vs "Grant, Jennifer"
 * by stripping middle initials and keeping only "lastname_firstname".
 */
export function normalizePatientKey(name: string | undefined | null): string {
  if (!name || !name.trim()) return '__unknown__';
  return name
    .toLowerCase()
    .replace(/[^a-z, ]/g, '') // strip middle initials & punctuation
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 2) // keep only last, first
    .join('_');
}
