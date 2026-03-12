import { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  ParsedEndOfDay, ParsedCMR, DashboardFilters, DashboardMetrics,
  CarePathAnalysisResult,
} from '@/types/reports';
import type { EvidenceStore } from '@/types/evidence';
import type { SequenceAnalysisResult } from '@/lib/kpi/analyzeSequences';
import type { ValidationReport } from '@/lib/kpi/validateReport';
import type { Insight } from '@/lib/kpi/generateInsights';
import type { PatientFunnelResult } from '@/lib/kpi/patientFunnel';
import type { PatientRiskResult } from '@/lib/kpi/patientRisk';
import type { RevenueMetrics } from '@/lib/kpi/revenueIntelligence';
import type { ClinicHealthScore } from '@/lib/kpi/clinicHealthScore';
import { calculateDashboardMetrics, DEFAULT_FILTERS } from '@/lib/kpi/calculateDashboardMetrics';
import { analyzeCarePathIntegrity } from '@/lib/kpi/analyzeCarePathIntegrity';
import { analyzeSequences } from '@/lib/kpi/analyzeSequences';
import { validateReport } from '@/lib/kpi/validateReport';
import { generateInsights, DEFAULT_THRESHOLDS, type InsightThresholds } from '@/lib/kpi/generateInsights';
import { buildEvidenceStore } from '@/lib/kpi/buildEvidenceStore';
import { buildPatientFunnel } from '@/lib/kpi/patientFunnel';
import { calculatePatientRisk } from '@/lib/kpi/patientRisk';
import { calculateRevenueMetrics } from '@/lib/kpi/revenueIntelligence';
import { calculateClinicHealthScore } from '@/lib/kpi/clinicHealthScore';

export interface Goals {
  rofRate: number;
  retentionRate: number;
  quarterlyKept: number;
  weeklyKept: number;
  avgVisitValue: number;
}

const defaultGoals: Goals = {
  rofRate: 74,
  retentionRate: 84,
  quarterlyKept: 390,
  weeklyKept: 30,
  avgVisitValue: 120,
};

interface DashboardContextValue {
  endOfDay: ParsedEndOfDay | null;
  cmr: ParsedCMR | null;
  metrics: DashboardMetrics | null;
  carePathAnalysis: CarePathAnalysisResult | null;
  sequenceAnalysis: SequenceAnalysisResult | null;
  validationReport: ValidationReport | null;
  insights: Insight[];
  evidenceStore: EvidenceStore;
  patientFunnel: PatientFunnelResult | null;
  patientRisk: PatientRiskResult | null;
  revenueMetrics: RevenueMetrics | null;
  clinicHealthScore: ClinicHealthScore | null;
  filters: DashboardFilters;
  activeFilters: DashboardFilters;
  goals: Goals;
  thresholds: InsightThresholds;
  selectedProvider: string;
  weeksOverride: string;
  allProviders: string[];
  calculatedWeeks: number;
  effectiveWeeks: number;
  isLoaded: boolean;

  setFilters: (f: DashboardFilters) => void;
  setGoals: (g: Goals) => void;
  setThresholds: (t: InsightThresholds) => void;
  setSelectedProvider: (p: string) => void;
  setWeeksOverride: (w: string) => void;
  loadData: (eod: ParsedEndOfDay, cmr: ParsedCMR) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [endOfDay, setEndOfDay] = useState<ParsedEndOfDay | null>(null);
  const [cmr, setCmr] = useState<ParsedCMR | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [weeksOverride, setWeeksOverride] = useState('');
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [thresholds, setThresholds] = useState<InsightThresholds>(DEFAULT_THRESHOLDS);

  const loadData = useCallback((eod: ParsedEndOfDay, cmrData: ParsedCMR) => {
    setEndOfDay(eod);
    setCmr(cmrData);
  }, []);

  const allProviders = useMemo(() => {
    if (!endOfDay || !cmr) return [];
    return [...new Set([...endOfDay.providers, ...cmr.providers])].sort();
  }, [endOfDay, cmr]);

  const activeFilters = useMemo((): DashboardFilters => {
    const wo = parseInt(weeksOverride);
    return {
      ...filters,
      provider: selectedProvider === 'All' ? undefined : selectedProvider,
      weeksOverride: wo > 0 ? wo : undefined,
    };
  }, [filters, selectedProvider, weeksOverride]);

  const calculatedWeeks = useMemo(() => {
    if (!endOfDay?.minDate || !endOfDay?.maxDate) return 1;
    const diff = (new Date(endOfDay.maxDate).getTime() - new Date(endOfDay.minDate).getTime()) / 86400000;
    return Math.max(1, Math.ceil(diff / 7));
  }, [endOfDay]);

  const effectiveWeeks = useMemo(() => {
    const wo = parseInt(weeksOverride);
    return wo > 0 ? wo : calculatedWeeks;
  }, [weeksOverride, calculatedWeeks]);

  const metrics = useMemo(() => {
    if (!endOfDay || !cmr) return null;
    return calculateDashboardMetrics(endOfDay, cmr, activeFilters);
  }, [endOfDay, cmr, activeFilters]);

  const carePathAnalysis = useMemo(() => {
    if (!endOfDay || !cmr) return null;
    const filteredAppts = activeFilters.provider
      ? endOfDay.appointments.filter(a => a.provider.toLowerCase().trim() === activeFilters.provider!.toLowerCase().trim())
      : endOfDay.appointments;
    const filteredCmr = activeFilters.provider
      ? cmr.rows.filter(r => (r.provider ?? '').toLowerCase().trim() === activeFilters.provider!.toLowerCase().trim())
      : cmr.rows;
    return analyzeCarePathIntegrity(filteredAppts, filteredCmr, activeFilters, endOfDay.maxDate);
  }, [endOfDay, cmr, activeFilters]);

  const sequenceAnalysis = useMemo(() => {
    if (!endOfDay) return null;
    const filteredAppts = activeFilters.provider
      ? endOfDay.appointments.filter(a => a.provider.toLowerCase().trim() === activeFilters.provider!.toLowerCase().trim())
      : endOfDay.appointments;
    return analyzeSequences(filteredAppts, activeFilters, endOfDay.maxDate);
  }, [endOfDay, activeFilters]);

  const validationReport = useMemo(() => {
    if (!endOfDay || !cmr) return null;
    return validateReport(endOfDay, cmr, activeFilters);
  }, [endOfDay, cmr, activeFilters]);

  const insights = useMemo(() => {
    if (!metrics || !carePathAnalysis || !validationReport) return [];
    return generateInsights(metrics, carePathAnalysis, validationReport, thresholds);
  }, [metrics, carePathAnalysis, validationReport, thresholds]);

  const evidenceStore = useMemo((): EvidenceStore => {
    if (!metrics || !endOfDay || !cmr) return {};
    return buildEvidenceStore(metrics, endOfDay, cmr, activeFilters, validationReport);
  }, [metrics, endOfDay, cmr, activeFilters, validationReport]);

  // Patient Flow Funnel — unique patient counts
  const patientFunnel = useMemo(() => {
    if (!endOfDay) return null;
    return buildPatientFunnel(endOfDay.appointments, activeFilters, activeFilters.provider);
  }, [endOfDay, activeFilters]);

  // Patient Risk scoring
  const patientRisk = useMemo(() => {
    if (!endOfDay || !cmr) return null;
    return calculatePatientRisk(endOfDay.appointments, cmr.rows, activeFilters, activeFilters.provider);
  }, [endOfDay, cmr, activeFilters]);

  // Revenue Intelligence
  const revenueMetrics = useMemo(() => {
    if (!endOfDay || !patientFunnel) return null;
    const npToRofRate = patientFunnel.npPatientCount > 0
      ? patientFunnel.rofPatientCount / patientFunnel.npPatientCount
      : 0;
    return calculateRevenueMetrics(endOfDay.appointments, activeFilters, npToRofRate, activeFilters.provider);
  }, [endOfDay, patientFunnel, activeFilters]);

  // Clinic Health Score
  const clinicHealthScore = useMemo(() => {
    if (!metrics || !patientFunnel) return null;

    const scheduleReliability = metrics.totalScheduled > 0
      ? metrics.totalCompleted / metrics.totalScheduled
      : 0;

    const treatmentFollowThrough = patientFunnel.rofPatientCount > 0
      ? patientFunnel.txStartedCount / patientFunnel.rofPatientCount
      : 0;

    const disruptionRate = metrics.totalScheduled > 0
      ? (metrics.totalCanceled + metrics.totalNoShow + metrics.rescheduledCount) / metrics.totalScheduled
      : 0;

    const npToRofConversion = patientFunnel.npPatientCount > 0
      ? patientFunnel.rofPatientCount / patientFunnel.npPatientCount
      : 0;

    const careContinuation = patientFunnel.txStartedCount > 0
      ? patientFunnel.activeCareCount / patientFunnel.txStartedCount
      : 0;

    return calculateClinicHealthScore({
      treatmentFollowThrough,
      scheduleReliability,
      disruptionResistance: 1 - disruptionRate,
      npToRofConversion,
      careContinuation,
    });
  }, [metrics, patientFunnel]);

  const isLoaded = !!(endOfDay && cmr && metrics);

  const value: DashboardContextValue = {
    endOfDay, cmr, metrics, carePathAnalysis, sequenceAnalysis, validationReport, insights,
    evidenceStore, patientFunnel, patientRisk, revenueMetrics, clinicHealthScore,
    filters, activeFilters, goals, thresholds, selectedProvider, weeksOverride,
    allProviders, calculatedWeeks, effectiveWeeks, isLoaded,
    setFilters, setGoals, setThresholds, setSelectedProvider, setWeeksOverride, loadData,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
