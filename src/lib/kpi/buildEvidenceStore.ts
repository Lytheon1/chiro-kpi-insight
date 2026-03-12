import { containsAny, normalizeText } from '../utils/normalize';
import type {
  ParsedEndOfDay, ParsedCMR, DashboardFilters, DashboardMetrics,
  EndOfDayAppointmentRow, CmrRow,
} from '../../types/reports';
import type { EvidenceStore, MetricWithEvidence, MetricConfidence } from '../../types/evidence';
import { METRIC_KEYS } from '../../types/evidence';
import type { ValidationReport } from './validateReport';

function makeEvidence<T>(
  value: T,
  opts: Partial<MetricWithEvidence<T>> & Pick<MetricWithEvidence<T>, 'formula' | 'scope' | 'sourceReports'>
): MetricWithEvidence<T> {
  return {
    value,
    numeratorRows: [],
    denominatorRows: [],
    confidence: 'high',
    ...opts,
  };
}

function confidenceFromVariance(pctDiff: number): MetricConfidence {
  if (pctDiff < 3) return 'high';
  if (pctDiff < 10) return 'medium';
  return 'low';
}

export function buildEvidenceStore(
  metrics: DashboardMetrics,
  endOfDay: ParsedEndOfDay,
  cmr: ParsedCMR,
  filters: DashboardFilters,
  validation: ValidationReport | null,
): EvidenceStore {
  const store: EvidenceStore = {};
  const appts = filters.provider
    ? endOfDay.appointments.filter(a => normalizeText(a.provider) === normalizeText(filters.provider!))
    : endOfDay.appointments;

  const cmrRows = filters.provider
    ? cmr.rows.filter(r => normalizeText(r.provider ?? '') === normalizeText(filters.provider!))
    : cmr.rows;

  // Helper: find validation confidence for a field
  const fieldConf = (fieldName: string): MetricConfidence => {
    if (!validation) return 'medium';
    const f = validation.fields.find(v => v.field === fieldName);
    if (!f) return 'medium';
    return confidenceFromVariance(f.pctDifference);
  };

  // ROF Completion Rate
  const rofDenom = appts.filter(a => {
    const s = normalizeText(a.statusRaw);
    const p = normalizeText(a.purposeRaw);
    return containsAny(p, filters.rofKeywords) &&
      (containsAny(s, filters.completedKeywords) || containsAny(s, filters.canceledKeywords) || containsAny(s, filters.noShowKeywords));
  });
  const rofNum = rofDenom.filter(a => containsAny(normalizeText(a.statusRaw), filters.completedKeywords));
  store[METRIC_KEYS.ROF_COMPLETION_RATE] = makeEvidence(metrics.rofCompletionRate, {
    scope: 'reportA_rows',
    formula: 'Completed ROF / Scheduled ROF (checked-out + canceled + no-show)',
    sourceReports: ['A'],
    numeratorRows: rofNum,
    denominatorRows: rofDenom,
    confidence: 'high',
  });

  // Retention Rate
  const retDenom = appts.filter(a => {
    const s = normalizeText(a.statusRaw);
    const p = normalizeText(a.purposeRaw);
    const isMassage = containsAny(p, filters.massageKeywords);
    const isExcluded = filters.excludedPurposeKeywords?.length ? containsAny(p, filters.excludedPurposeKeywords) : false;
    return !isMassage && !isExcluded &&
      (containsAny(s, filters.completedKeywords) || containsAny(s, filters.canceledKeywords) || containsAny(s, filters.noShowKeywords));
  });
  const retNum = retDenom.filter(a => containsAny(normalizeText(a.statusRaw), filters.completedKeywords));
  store[METRIC_KEYS.RETENTION_RATE] = makeEvidence(metrics.retentionRate, {
    scope: 'reportA_rows',
    formula: 'Completed non-massage / Scheduled non-massage',
    sourceReports: ['A'],
    numeratorRows: retNum,
    denominatorRows: retDenom,
    confidence: fieldConf('Checked-Out / Kept'),
  });

  // Total Kept
  store[METRIC_KEYS.TOTAL_KEPT] = makeEvidence(metrics.keptNonMassage, {
    scope: 'reportA_rows',
    formula: 'Count of non-massage, non-excluded appointments with completed status',
    sourceReports: ['A'],
    numeratorRows: retNum,
    denominatorRows: retDenom,
    confidence: fieldConf('Checked-Out / Kept'),
  });

  // Rescheduled Count
  const reschRows = cmrRows.filter(r => containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords));
  store[METRIC_KEYS.RESCHEDULED_COUNT] = makeEvidence(metrics.rescheduledCount, {
    scope: 'reportB_rows',
    formula: 'Count of rows matching rescheduled keywords in Report B',
    sourceReports: ['B'],
    numeratorRows: reschRows as any,
    denominatorRows: cmrRows as any,
    confidence: 'high',
    confidenceNote: 'Report B is the sole source for reschedule counts.',
  });

  // New Patients
  store[METRIC_KEYS.NEW_PATIENTS] = makeEvidence(metrics.newPatients, {
    scope: 'reportA_totals',
    formula: 'Sum of newPatients from Report A daily totals blocks',
    sourceReports: ['A'],
    numeratorRows: [],
    denominatorRows: [],
    confidence: fieldConf('New Patients'),
    confidenceNote: validation?.hasNewPatientDiscrepancy
      ? 'Row-level and totals counts disagree — use with caution.'
      : undefined,
  });

  return store;
}
