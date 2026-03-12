import { containsAny, normalizeText } from "../utils/normalize";
import type { ParsedEndOfDay, ParsedCMR, DashboardFilters } from "../../types/reports";

export type ConfidenceLevel = 'high' | 'review' | 'low';

export interface FieldValidation {
  field: string;
  rowLevelCount: number;
  totalsCount: number;
  difference: number;
  pctDifference: number;
  confidence: ConfidenceLevel;
  recommendation: string;
}

export interface ReportMismatch {
  type: 'provider' | 'dateRange';
  detail: string;
}

export interface ValidationReport {
  fields: FieldValidation[];
  mismatches: ReportMismatch[];
  hasNewPatientDiscrepancy: boolean;
  overallConfidence: ConfidenceLevel;
}

function getConfidence(pctDiff: number): ConfidenceLevel {
  if (pctDiff <= 0) return 'high';
  if (pctDiff < 5) return 'review';
  return 'low';
}

function getRecommendation(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high': return 'Okay to use';
    case 'review': return 'Use with caution';
    case 'low': return 'Do not use for provider scoring';
  }
}

export function validateReport(
  endOfDay: ParsedEndOfDay,
  cmr: ParsedCMR,
  filters: DashboardFilters
): ValidationReport {
  const appts = endOfDay.appointments;
  const totals = endOfDay.dailyTotals;

  // Row-level counts
  const rowNewPatients = appts.filter(a =>
    containsAny(normalizeText(a.purposeRaw), filters.newPatientKeywords) &&
    containsAny(normalizeText(a.statusRaw), filters.completedKeywords)
  ).length;
  const rowCheckedOut = appts.filter(a =>
    containsAny(normalizeText(a.statusRaw), filters.completedKeywords)
  ).length;
  const rowCanceled = appts.filter(a =>
    containsAny(normalizeText(a.statusRaw), filters.canceledKeywords)
  ).length;
  const rowNoShow = appts.filter(a =>
    containsAny(normalizeText(a.statusRaw), filters.noShowKeywords)
  ).length;

  // Totals-level counts
  const totNewPatients = totals.reduce((s, t) => s + (t.newPatients ?? 0), 0);
  const totCheckedOut = totals.reduce((s, t) => s + (t.checkedOutAppointments ?? 0), 0);
  const totCanceled = totals.reduce((s, t) => s + (t.canceledAppointments ?? 0), 0);
  const totNoShow = totals.reduce((s, t) => s + (t.noShowAppointments ?? 0), 0);

  const makeField = (field: string, rowCount: number, totalCount: number): FieldValidation => {
    const diff = rowCount - totalCount;
    const pctDiff = totalCount > 0 ? Math.abs(diff / totalCount) * 100 : (rowCount > 0 ? 100 : 0);
    const confidence = getConfidence(pctDiff);
    return {
      field,
      rowLevelCount: rowCount,
      totalsCount: totalCount,
      difference: diff,
      pctDifference: pctDiff,
      confidence,
      recommendation: getRecommendation(confidence),
    };
  };

  const fields: FieldValidation[] = [
    makeField('New Patients', rowNewPatients, totNewPatients),
    makeField('Checked-Out / Kept', rowCheckedOut, totCheckedOut),
    makeField('Canceled', rowCanceled, totCanceled),
    makeField('No-Show', rowNoShow, totNoShow),
  ];

  // Report mismatches
  const mismatches: ReportMismatch[] = [];

  const aProviders = new Set(endOfDay.providers.map(p => p.toLowerCase().trim()));
  const bProviders = new Set(cmr.providers.map(p => p.toLowerCase().trim()));

  for (const p of aProviders) {
    if (!bProviders.has(p)) {
      mismatches.push({ type: 'provider', detail: `"${p}" appears in Report A but not Report B` });
    }
  }
  for (const p of bProviders) {
    if (!aProviders.has(p)) {
      mismatches.push({ type: 'provider', detail: `"${p}" appears in Report B but not Report A` });
    }
  }

  if (endOfDay.minDate && cmr.minDate && endOfDay.minDate !== cmr.minDate) {
    mismatches.push({
      type: 'dateRange',
      detail: `Report A starts ${endOfDay.minDate}, Report B starts ${cmr.minDate}`,
    });
  }
  if (endOfDay.maxDate && cmr.maxDate && endOfDay.maxDate !== cmr.maxDate) {
    mismatches.push({
      type: 'dateRange',
      detail: `Report A ends ${endOfDay.maxDate}, Report B ends ${cmr.maxDate}`,
    });
  }

  const npField = fields.find(f => f.field === 'New Patients')!;
  const hasNewPatientDiscrepancy = npField.confidence === 'low';

  const overallConfidence: ConfidenceLevel = fields.some(f => f.confidence === 'low')
    ? 'low'
    : fields.some(f => f.confidence === 'review')
      ? 'review'
      : 'high';

  return { fields, mismatches, hasNewPatientDiscrepancy, overallConfidence };
}
