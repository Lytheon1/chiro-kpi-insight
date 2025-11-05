export interface AppointmentRow {
  [key: string]: any;
  status?: string;
  purpose?: string;
  provider?: string;
  date?: Date | string;
  _statusNormalized?: string;
  _purposeNormalized?: string;
}

export interface ColumnMapping {
  status: string;
  purpose: string;
  provider: string;
  date: string;
  patient: string;
}

export interface Keywords {
  completed: string;
  canceled: string;
  noShow: string;
  rof: string;
  excludeKeywords: string; // Comma-separated list of keywords to exclude from KPI calculations
}

export interface Goals {
  rofRate: number;
  retentionRate: number;
  quarterlyKept: number;
  weeklyKept: number;
}

export interface KPIMetrics {
  scheduledROF: number;
  completedROF: number;
  rofCompletionRate: number;
  scheduledNonMassage: number;
  completedNonMassage: number;
  retentionRate: number;
  totalKeptNonMassage: number;
  weeklyAverage: number;
}

export interface DashboardData {
  rows: AppointmentRow[];
  dateRange: { min: Date | null; max: Date | null };
  providers: string[];
  weeks: number;
}

export interface WeeklyData {
  weekStart: string;
  keptAppointments: number;
  rofCompletionRate: number;
  retentionRate: number;
}
