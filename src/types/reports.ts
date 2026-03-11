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
  topCancelReasons: Array<{ reason: string; count: number }>;
  topRescheduleReasons: Array<{ reason: string; count: number }>;
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
