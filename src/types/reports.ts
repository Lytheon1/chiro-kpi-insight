// ─── Report A types ───────────────────────────────────────────────────────────

export interface EndOfDayAppointmentRow {
  source: "endOfDay";
  date: string;          // ISO yyyy-mm-dd
  provider: string;
  location?: string;
  scheduledTime?: string;
  statusRaw: string;
  purposeRaw: string;
  checkInRaw?: string;
  postedChargesRaw?: string | number;
  patientName?: string;
  // Derived flags (set at parse time via classifyRow)
  isCompleted?: boolean;
  isCanceled?: boolean;
  isNoShow?: boolean;
  isRescheduled?: boolean;
  isROF?: boolean;
  isMassage?: boolean;
  isNewPatient?: boolean;
  isReturnVisit?: boolean;
  isSupportiveCare?: boolean;
  isLTC?: boolean;
  isReExam?: boolean;
  isPTF?: boolean;
  isFinalEval?: boolean;
  isExcluded?: boolean;
}

export interface EndOfDayDailyTotals {
  source: "endOfDayTotals";
  date: string;          // ISO yyyy-mm-dd
  provider: string;
  location?: string;
  scheduledAppointments?: number;
  noShowAppointments?: number;
  walkInAppointments?: number;
  canceledAppointments?: number;
  newPatients?: number;
  currentPatients?: number;
  totalPatients?: number;
  totalAppointments?: number;
  checkedOutAppointments?: number;
  patientsEncountered?: number;
}

export interface ParsedEndOfDay {
  appointments: EndOfDayAppointmentRow[];
  dailyTotals: EndOfDayDailyTotals[];
  minDate?: string;
  maxDate?: string;
  providers: string[];
}

// ─── Report B types ───────────────────────────────────────────────────────────

export interface CmrRow {
  source: "cmr";
  date: string;          // ISO yyyy-mm-dd
  time?: string;
  provider?: string;
  location?: string;
  apptTypeRaw: string;
  statusRaw: string;
  reasonRaw?: string;
  patientName?: string;
  // Derived flags
  isCompleted?: boolean;
  isCanceled?: boolean;
  isNoShow?: boolean;
  isRescheduled?: boolean;
  isROF?: boolean;
  isMassage?: boolean;
  isNewPatient?: boolean;
  isReturnVisit?: boolean;
  isSupportiveCare?: boolean;
  isLTC?: boolean;
  isReExam?: boolean;
  isPTF?: boolean;
  isFinalEval?: boolean;
  isExcluded?: boolean;
}

export interface ParsedCMR {
  rows: CmrRow[];
  minDate?: string;
  maxDate?: string;
  providers: string[];
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface DashboardFilters {
  provider?: string;
  rofKeywords: string[];
  massageKeywords: string[];
  completedKeywords: string[];
  canceledKeywords: string[];
  noShowKeywords: string[];
  rescheduledKeywords: string[];
  excludedPurposeKeywords?: string[];
  newPatientKeywords: string[];
  returnVisitKeywords: string[];
  reExamKeywords: string[];
  finalEvalKeywords: string[];
  ptfKeywords: string[];
  supportiveCareKeywords: string[];
  ltcKeywords: string[];
  weeksOverride?: number;
}

export interface DashboardMetrics {
  scheduledROF: number;
  completedROF: number;
  rofCompletionRate: number;
  scheduledNonMassage: number;
  completedNonMassage: number;
  retentionRate: number;
  keptNonMassage: number;
  avgPerWeek: number;
  rescheduledCount: number;
  canceledDetailCount: number;
  newPatients: number;
  currentPatients: number;
  weeklyKept: Array<{ week: string; value: number }>;
  weeklyROFRate: Array<{ week: string; value: number }>;
  weeklyRetentionRate: Array<{ week: string; value: number }>;
  weeklyRescheduled: Array<{ week: string; value: number }>;
  weeklyCanceled: Array<{ week: string; value: number }>;
  weeklyNoShow: Array<{ week: string; value: number }>;
  topCancelReasons: Array<{ reason: string; count: number }>;
  topRescheduleReasons: Array<{ reason: string; count: number }>;
  // Raw rows grouped by week for drill-down modals
  weeklyRows: Map<string, EndOfDayAppointmentRow[]>;
  weeklyCmrRows: Map<string, CmrRow[]>;
  // Provider disruption breakdown
  providerDisruptions: ProviderDisruptionRow[];
  // Reschedule breakdowns
  rescheduledByProvider: Array<{ provider: string; count: number }>;
  rescheduledByApptType: Array<{ type: string; count: number }>;
  repeatRescheduledPatients: number;
  disruptionHeavyPatients: number;
}

export interface ProviderDisruptionRow {
  provider: string;
  canceled: number;
  noShow: number;
  rescheduled: number;
  totalDisruptions: number;
  scheduledDenom: number;
  disruptionRate: number;
}

export interface ParseDiagnostics {
  reportARows: number;
  reportATotalsRows: number;
  reportBRowsRaw: number;
  reportBRowsDeduped: number;
  reportAProviders: string[];
  reportBProviders: string[];
  reportADateRange?: string;
  reportBDateRange?: string;
}

// ─── Care Path types ──────────────────────────────────────────────────────────

export type CarePathClassification =
  | 'progressed_as_expected'
  | 'maintenance_phase_only'
  | 'possible_progression_gap'
  | 'quarter_boundary_unclear'
  | 'disruption_heavy'
  | 'needs_review';

export interface PatientJourney {
  patientName: string;
  provider: string;
  visits: EndOfDayAppointmentRow[];
  classification: CarePathClassification;
  secondaryFlags: CarePathClassification[];
  disruptionCount: number;
}

export interface ProviderCarePathMetrics {
  provider: string;
  newPatientCount: number;
  rofCount: number;
  npToRofConversionRate: number;
  rofToActiveTreatmentRate: number;
  directToScCount: number;
  directToLtcCount: number;
  rofNoFollowThroughCount: number;
  carePathIntegrityScore: number;
  classificationCounts: Record<CarePathClassification, number>;
}

export interface CarePathAnalysisResult {
  journeys: PatientJourney[];
  providerMetrics: ProviderCarePathMetrics[];
  patientsNeedingReview: PatientJourney[];
  maintenanceOnlyCount: number;
  quarterBoundaryUnclearCount: number;
  missingNamePercentage: number;
  isPathAnalysisReliable: boolean;
}

// ─── Unified row for operational table ────────────────────────────────────────

export interface UnifiedRow {
  id: string;
  date: string;
  time?: string;
  patientName?: string;
  provider: string;
  location?: string;
  visitType: string;
  status: string;
  reason?: string;
  sourceReport: 'A' | 'B';
  isCompleted: boolean;
  isCanceled: boolean;
  isNoShow: boolean;
  isRescheduled: boolean;
  isROF: boolean;
  carePathFlag?: CarePathClassification;
}
