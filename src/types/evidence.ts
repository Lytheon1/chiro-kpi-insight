import type { EndOfDayAppointmentRow } from './reports';

// ─── Metric Scope ─────────────────────────────────────────────────────────────
export type MetricScope =
  | 'reportA_rows'
  | 'reportA_totals'
  | 'reportB_rows'
  | 'combined_reports'
  | 'patient_journey';

// ─── Journey Evidence ─────────────────────────────────────────────────────────
export interface JourneyEvidence {
  patientName?: string;
  patientKey: string;
  classification?: string;
  milestoneRow?: EndOfDayAppointmentRow;
  supportingRows: EndOfDayAppointmentRow[];
  explanation?: string;
}

// ─── Confidence ───────────────────────────────────────────────────────────────
export type MetricConfidence = 'high' | 'medium' | 'low';

// ─── Metric With Evidence ─────────────────────────────────────────────────────
export interface MetricWithEvidence<T = number> {
  value: T;
  scope: MetricScope;
  numeratorRows: EndOfDayAppointmentRow[];
  denominatorRows: EndOfDayAppointmentRow[];
  numeratorJourneys?: JourneyEvidence[];
  denominatorJourneys?: JourneyEvidence[];
  formula: string;
  sourceReports: ('A' | 'B')[];
  confidence: MetricConfidence;
  confidenceNote?: string;
}

// ─── Evidence Store ───────────────────────────────────────────────────────────
export type EvidenceStore = Record<string, MetricWithEvidence<any>>;

// ─── Metric Keys ──────────────────────────────────────────────────────────────
export const METRIC_KEYS = {
  ROF_COMPLETION_RATE: 'rofCompletionRate',
  RETENTION_RATE: 'retentionRate',
  TOTAL_KEPT: 'totalKept',
  WEEKLY_AVERAGE: 'weeklyAverage',
  RESCHEDULED_COUNT: 'rescheduledCount',
  NEW_PATIENTS: 'newPatients',
  CURRENT_PATIENTS: 'currentPatients',
  PATIENTS_NEEDING_REVIEW: 'patientsNeedingReview',
  NP_TO_ROF_RATE: 'npToRofRate',
  ROF_TO_ACTIVE_TX_RATE: 'rofToActiveTxRate',
  UNEXPECTED_NEXT_STEP: 'unexpectedNextStep',
  DISRUPTION_HEAVY: 'disruptionHeavy',
} as const;
