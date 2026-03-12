/**
 * Drilldown system — shared types, registry, and dataset builders.
 * 
 * Every clickable metric maps to a DrilldownConfig that defines:
 * - where to navigate
 * - what rows to show
 * - how to explain the metric
 */
import type { EndOfDayAppointmentRow, CmrRow, PatientJourney } from '@/types/reports';

// ─── Core Types ───────────────────────────────────────────────────────────────

export type DrilldownTarget =
  | 'patient_review'
  | 'patient_flow'
  | 'operational_analysis'
  | 'patients_at_risk';

export type DrilldownMode = 'patient' | 'event' | 'journey' | 'metric';
export type EvidenceMode = 'evidence' | 'full_journey';

export interface DrilldownRow {
  id: string;
  patientName: string;
  provider: string;
  date: string;
  visitType: string;
  status: string;
  sourceReport: 'A' | 'B';
  isEvidence: boolean;      // true = this row explains the metric
  isContext: boolean;        // true = context row (adjacent visit)
  reason?: string;
  milestoneLabel?: string;   // e.g. "NP", "ROF", "Tx #3"
}

export interface DrilldownPatient {
  patientName: string;
  patientKey: string;
  provider: string;
  lastVisitDate: string;
  completedVisitCount: number;
  stages?: string[];
  riskScore?: number;
  evidenceRows: DrilldownRow[];
  fullJourneyRows?: DrilldownRow[];
}

export interface DrilldownDataset {
  key: string;
  label: string;
  description: string;
  mode: DrilldownMode;
  patients: DrilldownPatient[];
  summary: {
    totalPatients: number;
    totalEvidenceRows: number;
    numerator?: number;
    denominator?: number;
    pct?: number;
    formula?: string;
  };
}

export interface ActiveDrilldown {
  key: string;
  label: string;
  description: string;
  dataset: DrilldownDataset;
  evidenceMode: EvidenceMode;
  tab?: 'all' | 'numerator' | 'denominator' | 'failed';
}

// ─── Drilldown Key Constants ──────────────────────────────────────────────────

export const DRILLDOWN_KEYS = {
  // Patient Review
  PROGRESSION_GAP: 'progression_gap',
  DISRUPTION_HEAVY: 'disruption_heavy',
  REPEAT_RESCHEDULE: 'repeat_reschedule',
  NEEDS_REVIEW: 'needs_review',
  REPEAT_NOSHOW: 'repeat_noshow',

  // Patient Flow / Funnel
  FUNNEL_NP: 'funnel_np',
  FUNNEL_ROF: 'funnel_rof',
  FUNNEL_TX_STARTED: 'funnel_tx_started',
  FUNNEL_ACTIVE_CARE: 'funnel_active_care',
  FUNNEL_MAINTENANCE: 'funnel_maintenance',

  // Retention metrics
  SCHEDULE_RELIABILITY: 'schedule_reliability',
  TREATMENT_FOLLOW_THROUGH: 'treatment_follow_through',
  CARE_CONTINUATION: 'care_continuation',

  // Sequence analysis
  NP_NEXT_STEP: 'np_next_step',
  ROF_PATH: 'rof_path',

  // Risk
  HIGH_RISK: 'high_risk',
  MEDIUM_RISK: 'medium_risk',
} as const;

// ─── Dataset Builders ─────────────────────────────────────────────────────────

/** Build a drilldown from funnel stage patients */
export function buildFunnelDrilldown(
  stageLabel: string,
  patients: Array<{ name: string; provider: string; lastVisitDate: string; stages: string[]; completedVisitCount: number }>,
  allStages: Array<{ label: string; count: number }>,
  stageIndex: number,
): DrilldownDataset {
  const prevCount = stageIndex > 0 ? allStages[stageIndex - 1].count : null;
  const count = allStages[stageIndex].count;

  return {
    key: `funnel_${stageLabel}`,
    label: stageLabel,
    description: `Unique patients who completed the "${stageLabel}" care stage.`,
    mode: 'patient',
    patients: patients.map((p, i) => ({
      patientName: p.name,
      patientKey: p.name.toLowerCase().replace(/[^a-z,]/g, ''),
      provider: p.provider,
      lastVisitDate: p.lastVisitDate,
      completedVisitCount: p.completedVisitCount,
      stages: p.stages,
      evidenceRows: [],
    })),
    summary: {
      totalPatients: count,
      totalEvidenceRows: 0,
      numerator: count,
      denominator: prevCount ?? undefined,
      pct: prevCount ? (count / prevCount) * 100 : undefined,
      formula: prevCount
        ? `${stageLabel} patients / ${allStages[stageIndex - 1].label} patients = ${count} / ${prevCount}`
        : `${count} unique patients`,
    },
  };
}

/** Build drilldown for Care Continuation metric */
export function buildCareContinuationDrilldown(
  txStartedPatients: Array<{ name: string; provider: string; lastVisitDate: string; stages: string[]; completedVisitCount: number }>,
  activeCarePatients: Array<{ name: string; provider: string; lastVisitDate: string; stages: string[]; completedVisitCount: number }>,
): DrilldownDataset {
  const activeCareNames = new Set(activeCarePatients.map(p => p.name.toLowerCase()));
  const failedPatients = txStartedPatients.filter(p => !activeCareNames.has(p.name.toLowerCase()));

  const allPatients = txStartedPatients.map(p => ({
    patientName: p.name,
    patientKey: p.name.toLowerCase().replace(/[^a-z,]/g, ''),
    provider: p.provider,
    lastVisitDate: p.lastVisitDate,
    completedVisitCount: p.completedVisitCount,
    stages: p.stages,
    evidenceRows: [],
    _isContinued: activeCareNames.has(p.name.toLowerCase()),
  }));

  return {
    key: DRILLDOWN_KEYS.CARE_CONTINUATION,
    label: 'Care Continuation',
    description: 'Patients who started treatment and whether they reached 3+ treatment visits (active care pattern).',
    mode: 'patient',
    patients: allPatients,
    summary: {
      totalPatients: txStartedPatients.length,
      totalEvidenceRows: 0,
      numerator: activeCarePatients.length,
      denominator: txStartedPatients.length,
      pct: txStartedPatients.length > 0 ? (activeCarePatients.length / txStartedPatients.length) * 100 : 0,
      formula: `Patients with 3+ treatment visits / Treatment starters = ${activeCarePatients.length} / ${txStartedPatients.length}`,
    },
  };
}

/** Build drilldown for disruption-heavy journeys — evidence rows only */
export function buildDisruptionDrilldown(
  journeys: PatientJourney[],
  disruptionKeywords: { canceled: string[]; noShow: string[]; rescheduled: string[] },
): DrilldownDataset {
  const disruptionJourneys = journeys.filter(j => j.secondaryFlags.includes('disruption_heavy'));

  const patients: DrilldownPatient[] = disruptionJourneys.map(j => {
    const evidenceRows: DrilldownRow[] = [];
    const fullRows: DrilldownRow[] = [];

    j.visits.forEach((v, i) => {
      const statusLower = v.statusRaw.toLowerCase();
      const isDisruption =
        disruptionKeywords.canceled.some(k => statusLower.includes(k)) ||
        disruptionKeywords.noShow.some(k => statusLower.includes(k)) ||
        disruptionKeywords.rescheduled.some(k => statusLower.includes(k));

      const row: DrilldownRow = {
        id: `${j.patientName}-${i}`,
        patientName: j.patientName,
        provider: v.provider,
        date: v.date,
        visitType: v.purposeRaw,
        status: v.statusRaw,
        sourceReport: 'A',
        isEvidence: isDisruption,
        isContext: !isDisruption,
      };

      fullRows.push(row);
      if (isDisruption) evidenceRows.push(row);
    });

    return {
      patientName: j.patientName,
      patientKey: j.patientName.toLowerCase().replace(/[^a-z,]/g, ''),
      provider: j.provider,
      lastVisitDate: j.visits[j.visits.length - 1]?.date || '',
      completedVisitCount: j.visits.length,
      evidenceRows,
      fullJourneyRows: fullRows,
    };
  });

  return {
    key: DRILLDOWN_KEYS.DISRUPTION_HEAVY,
    label: 'Disruption-Heavy Patients',
    description: 'Patients with 2+ disruption events (canceled, no-show, rescheduled). Default view shows only disruption rows.',
    mode: 'event',
    patients,
    summary: {
      totalPatients: patients.length,
      totalEvidenceRows: patients.reduce((s, p) => s + p.evidenceRows.length, 0),
    },
  };
}

/** Build drilldown for NP next-step or ROF path chart bars */
export function buildSequenceDrilldown(
  categoryLabel: string,
  patients: Array<{ name: string; provider: string; npDate?: string; rofDate?: string; nextDate?: string; nextType?: string; visit1?: string; visit2?: string }>,
  type: 'np_next_step' | 'rof_path',
): DrilldownDataset {
  return {
    key: `${type}_${categoryLabel}`,
    label: categoryLabel,
    description: type === 'np_next_step'
      ? `Patients whose next meaningful step after NP was: "${categoryLabel}"`
      : `Patients whose ROF treatment start pattern was: "${categoryLabel}"`,
    mode: 'patient',
    patients: patients.map((p, i) => ({
      patientName: p.name,
      patientKey: p.name.toLowerCase().replace(/[^a-z,]/g, ''),
      provider: p.provider,
      lastVisitDate: p.npDate || p.rofDate || '',
      completedVisitCount: 0,
      evidenceRows: [],
    })),
    summary: {
      totalPatients: patients.length,
      totalEvidenceRows: 0,
    },
  };
}

/** Build drilldown for progression gap journeys */
export function buildProgressionGapDrilldown(
  journeys: PatientJourney[],
): DrilldownDataset {
  const gapJourneys = journeys.filter(j => j.classification === 'possible_progression_gap');

  const patients: DrilldownPatient[] = gapJourneys.map(j => {
    // Evidence = milestone rows (NP, ROF) + gap indicator
    const evidenceRows: DrilldownRow[] = [];
    const fullRows: DrilldownRow[] = [];

    j.visits.forEach((v, i) => {
      const purposeLower = v.purposeRaw.toLowerCase();
      const isMilestone = purposeLower.includes('new patient') || purposeLower.includes('rof') ||
        purposeLower.includes('report of findings') || purposeLower.includes('re-exam') ||
        purposeLower.includes('supportive care') || purposeLower.includes('ltc');

      const row: DrilldownRow = {
        id: `${j.patientName}-${i}`,
        patientName: j.patientName,
        provider: v.provider,
        date: v.date,
        visitType: v.purposeRaw,
        status: v.statusRaw,
        sourceReport: 'A',
        isEvidence: isMilestone,
        isContext: !isMilestone,
        milestoneLabel: isMilestone ? v.purposeRaw : undefined,
      };

      fullRows.push(row);
      if (isMilestone) evidenceRows.push(row);
    });

    return {
      patientName: j.patientName,
      patientKey: j.patientName.toLowerCase().replace(/[^a-z,]/g, ''),
      provider: j.provider,
      lastVisitDate: j.visits[j.visits.length - 1]?.date || '',
      completedVisitCount: j.visits.length,
      evidenceRows,
      fullJourneyRows: fullRows,
    };
  });

  return {
    key: DRILLDOWN_KEYS.PROGRESSION_GAP,
    label: 'Progression Gap',
    description: 'Patients whose care path shows a possible gap — e.g., ROF completed but no active treatment visits followed.',
    mode: 'journey',
    patients,
    summary: {
      totalPatients: patients.length,
      totalEvidenceRows: patients.reduce((s, p) => s + p.evidenceRows.length, 0),
    },
  };
}
