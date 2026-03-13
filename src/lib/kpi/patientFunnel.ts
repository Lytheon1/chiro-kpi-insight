/**
 * Patient Flow Funnel — uses UNIQUE PATIENT COUNTS, not visit rows.
 * Groups by normalizePatientKey and checks whether each patient ever
 * had each stage as a completed visit.
 */
import { normalizePatientKey } from '../utils/patientKey';
import { containsAny, normalizeText } from '../utils/normalize';
import type { EndOfDayAppointmentRow, DashboardFilters } from '@/types/reports';

export interface FunnelStage {
  label: string;
  count: number;
  conversionRate: number | null; // from previous stage
  dropOff: number;
  dropOffLabel: string;
}

export interface FunnelPatient {
  name: string;
  provider: string;
  lastVisitDate: string;
  stages: string[];
  completedVisitCount: number;
}

export interface PatientFunnelResult {
  stages: FunnelStage[];
  patients: Map<string, FunnelPatient>;
  stagePatients: Record<string, FunnelPatient[]>;
  npPatientCount: number;
  rofPatientCount: number;
  txStartedCount: number;
  activeCareCount: number;
  maintenanceCount: number;
  /** All unique patients with a completed SC/LTC visit this quarter (not restricted to NP cohort) */
  allSCLTCPatientCount: number;
}

export function buildPatientFunnel(
  appointments: EndOfDayAppointmentRow[],
  filters: DashboardFilters,
  providerFilter?: string,
): PatientFunnelResult {
  // Filter by provider
  const appts = providerFilter
    ? appointments.filter(a => normalizeText(a.provider) === normalizeText(providerFilter))
    : appointments;

  // Group by normalized patient key
  const journeys = new Map<string, EndOfDayAppointmentRow[]>();
  for (const a of appts) {
    const key = normalizePatientKey(a.patientName);
    if (key === '__unknown__') continue;
    if (!journeys.has(key)) journeys.set(key, []);
    journeys.get(key)!.push(a);
  }

  let npPatients = 0, rofPatients = 0, txStarted = 0, activeCare = 0, maintenance = 0;
  let allSCLTCPatients = 0;
  const patients = new Map<string, FunnelPatient>();
  const stagePatients: Record<string, FunnelPatient[]> = {
    'New Patients': [],
    'ROF Completed': [],
    'Treatment Started': [],
    'Active Care (3+)': [],
    'Maintenance / SC': [],
  };

  for (const [key, visits] of journeys) {
    const completed = visits.filter(v =>
      containsAny(normalizeText(v.statusRaw), filters.completedKeywords)
    );
    if (completed.length === 0) continue;

    const hasNP = completed.some(v => containsAny(normalizeText(v.purposeRaw), filters.newPatientKeywords));
    const hasROF = completed.some(v => containsAny(normalizeText(v.purposeRaw), filters.rofKeywords));

    // Treatment = return visits, traction, therapy, re-exam, final eval
    const isTreatmentVisit = (v: EndOfDayAppointmentRow) => {
      const p = normalizeText(v.purposeRaw);
      return containsAny(p, filters.returnVisitKeywords) ||
        (filters.tractionKeywords ? containsAny(p, filters.tractionKeywords) : false) ||
        (filters.therapyKeywords ? containsAny(p, filters.therapyKeywords) : false) ||
        containsAny(p, filters.reExamKeywords) ||
        containsAny(p, filters.finalEvalKeywords);
    };

    const hasTx = completed.some(isTreatmentVisit);
    const txCount = completed.filter(isTreatmentVisit).length;
    const hasSCLTC = completed.some(v => {
      const p = normalizeText(v.purposeRaw);
      return containsAny(p, filters.supportiveCareKeywords) || containsAny(p, filters.ltcKeywords);
    });

    // Track ALL patients with SC/LTC visits (not restricted to NP cohort)
    if (hasSCLTC) {
      allSCLTCPatients++;
    }

    const stages: string[] = [];
    const name = visits[0].patientName || key;
    const provider = visits[0].provider || '';
    const lastDate = visits[visits.length - 1].date;

    const patient: FunnelPatient = {
      name,
      provider,
      lastVisitDate: lastDate,
      stages,
      completedVisitCount: completed.length,
    };

    if (hasNP) {
      npPatients++;
      stages.push('New Patients');
      stagePatients['New Patients'].push(patient);
    }
    if (hasROF) {
      rofPatients++;
      stages.push('ROF Completed');
      stagePatients['ROF Completed'].push(patient);
    }
    if (hasROF && hasTx) {
      txStarted++;
      stages.push('Treatment Started');
      stagePatients['Treatment Started'].push(patient);
    }
    if (hasROF && txCount >= 3) {
      activeCare++;
      stages.push('Active Care (3+)');
      stagePatients['Active Care (3+)'].push(patient);
    }
    // RELAXED: Maintenance/SC requires ROF + any SC/LTC visit (does NOT require 3+ active care visits)
    if (hasROF && hasSCLTC) {
      maintenance++;
      stages.push('Maintenance / SC');
      stagePatients['Maintenance / SC'].push(patient);
    }

    patients.set(key, patient);
  }

  const stages: FunnelStage[] = [
    {
      label: 'New Patients',
      count: npPatients,
      conversionRate: null,
      dropOff: 0,
      dropOffLabel: '',
    },
    {
      label: 'ROF Completed',
      count: rofPatients,
      conversionRate: npPatients > 0 ? rofPatients / npPatients : null,
      dropOff: npPatients - rofPatients,
      dropOffLabel: `${npPatients - rofPatients} patients did not reach ROF`,
    },
    {
      label: 'Treatment Started',
      count: txStarted,
      conversionRate: rofPatients > 0 ? txStarted / rofPatients : null,
      dropOff: rofPatients - txStarted,
      dropOffLabel: `${rofPatients - txStarted} ROF patients with no downstream visit`,
    },
    {
      label: 'Active Care (3+)',
      count: activeCare,
      conversionRate: txStarted > 0 ? activeCare / txStarted : null,
      dropOff: txStarted - activeCare,
      dropOffLabel: `${txStarted - activeCare} patients did not reach 3+ treatment visits`,
    },
    {
      label: 'Maintenance / SC',
      count: maintenance,
      conversionRate: rofPatients > 0 ? maintenance / rofPatients : null,
      dropOff: Math.max(0, activeCare - maintenance),
      dropOffLabel: `${Math.max(0, activeCare - maintenance)} completed without entering maintenance`,
    },
  ];

  return {
    stages,
    patients,
    stagePatients,
    npPatientCount: npPatients,
    rofPatientCount: rofPatients,
    txStartedCount: txStarted,
    activeCareCount: activeCare,
    maintenanceCount: maintenance,
    allSCLTCPatientCount: allSCLTCPatients,
  };
}
