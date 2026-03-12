/**
 * Patient Risk Scoring — combines Report A journeys + Report B disruptions.
 * Uses fuzzy patient name matching via normalizePatientKey.
 */
import { normalizePatientKey } from '../utils/patientKey';
import { containsAny, normalizeText } from '../utils/normalize';
import type { EndOfDayAppointmentRow, CmrRow, DashboardFilters } from '@/types/reports';

export type RiskLevel = 'high' | 'medium' | 'low';

export interface RiskScoreBreakdown {
  reschedules: number;
  reschedulePoints: number;
  cancellations: number;
  cancellationPoints: number;
  noShows: number;
  noShowPoints: number;
  visitGap14: number;
  visitGap14Points: number;
  visitGap21: number;
  visitGap21Points: number;
  rofNoTreatment: boolean;
  rofNoTreatmentPoints: number;
  canceledFirstTxAfterRof: boolean;
  canceledFirstTxPoints: number;
}

export interface PatientRisk {
  patientKey: string;
  patientName: string;
  provider: string;
  riskScore: number;
  riskLevel: RiskLevel;
  breakdown: RiskScoreBreakdown;
  lastVisitDate: string;
  visitCount: number;
  suggestedAction: string;
}

export interface PatientRiskResult {
  patients: PatientRisk[];
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  riskDrivers: {
    repeatReschedules: number;
    multipleCancellations: number;
    visitGaps14: number;
    rofNoTreatment: number;
  };
}

export function calculatePatientRisk(
  appointments: EndOfDayAppointmentRow[],
  cmrRows: CmrRow[],
  filters: DashboardFilters,
  providerFilter?: string,
): PatientRiskResult {
  const appts = providerFilter
    ? appointments.filter(a => normalizeText(a.provider) === normalizeText(providerFilter))
    : appointments;
  const cmrs = providerFilter
    ? cmrRows.filter(r => normalizeText(r.provider ?? '') === normalizeText(providerFilter))
    : cmrRows;

  // Build Report A journeys
  const journeyMap = new Map<string, EndOfDayAppointmentRow[]>();
  for (const a of appts) {
    const key = normalizePatientKey(a.patientName);
    if (key === '__unknown__') continue;
    if (!journeyMap.has(key)) journeyMap.set(key, []);
    journeyMap.get(key)!.push(a);
  }
  for (const [, visits] of journeyMap) {
    visits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Build Report B disruption counts
  const cmrDisruptions = new Map<string, { reschedules: number; cancellations: number; noShows: number }>();
  for (const r of cmrs) {
    const key = normalizePatientKey(r.patientName);
    if (key === '__unknown__') continue;
    if (!cmrDisruptions.has(key)) cmrDisruptions.set(key, { reschedules: 0, cancellations: 0, noShows: 0 });
    const entry = cmrDisruptions.get(key)!;
    const status = normalizeText(r.statusRaw);
    if (containsAny(status, filters.rescheduledKeywords)) entry.reschedules++;
    if (containsAny(status, filters.canceledKeywords)) entry.cancellations++;
    if (containsAny(status, filters.noShowKeywords)) entry.noShows++;
  }

  // Combine all patient keys
  const allKeys = new Set([...journeyMap.keys(), ...cmrDisruptions.keys()]);
  allKeys.delete('__unknown__');

  const patients: PatientRisk[] = [];
  let highRisk = 0, mediumRisk = 0, lowRisk = 0;
  const drivers = { repeatReschedules: 0, multipleCancellations: 0, visitGaps14: 0, rofNoTreatment: 0 };

  for (const key of allKeys) {
    const visits = journeyMap.get(key) || [];
    const cmrData = cmrDisruptions.get(key) || { reschedules: 0, cancellations: 0, noShows: 0 };

    const breakdown: RiskScoreBreakdown = {
      reschedules: cmrData.reschedules,
      reschedulePoints: 0,
      cancellations: cmrData.cancellations,
      cancellationPoints: cmrData.cancellations * 2,
      noShows: cmrData.noShows,
      noShowPoints: cmrData.noShows * 3,
      visitGap14: 0,
      visitGap14Points: 0,
      visitGap21: 0,
      visitGap21Points: 0,
      rofNoTreatment: false,
      rofNoTreatmentPoints: 0,
      canceledFirstTxAfterRof: false,
      canceledFirstTxPoints: 0,
    };

    // Reschedule scoring: +1 first, +2 second, +3 each additional
    for (let i = 0; i < cmrData.reschedules; i++) {
      breakdown.reschedulePoints += Math.min(3, i + 1);
    }

    // Visit gap scoring from Report A
    const completedVisits = visits.filter(v =>
      containsAny(normalizeText(v.statusRaw), filters.completedKeywords)
    );
    for (let i = 1; i < completedVisits.length; i++) {
      const gap = (new Date(completedVisits[i].date).getTime() - new Date(completedVisits[i - 1].date).getTime()) / 86400000;
      if (gap > 21) {
        breakdown.visitGap21++;
        breakdown.visitGap21Points += 2;
      } else if (gap > 14) {
        breakdown.visitGap14++;
        breakdown.visitGap14Points += 1;
      }
    }

    // ROF with no treatment start
    const hasROF = completedVisits.some(v => containsAny(normalizeText(v.purposeRaw), filters.rofKeywords));
    const hasTx = completedVisits.some(v =>
      containsAny(normalizeText(v.purposeRaw), filters.returnVisitKeywords) ||
      (filters.tractionKeywords ? containsAny(normalizeText(v.purposeRaw), filters.tractionKeywords) : false)
    );
    if (hasROF && !hasTx) {
      breakdown.rofNoTreatment = true;
      breakdown.rofNoTreatmentPoints = 3;
    }

    // Canceled first treatment visit after ROF
    const rofIdx = visits.findIndex(v =>
      containsAny(normalizeText(v.statusRaw), filters.completedKeywords) &&
      containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
    );
    if (rofIdx >= 0) {
      const afterROF = visits.slice(rofIdx + 1);
      const firstTxAfterROF = afterROF.find(v =>
        containsAny(normalizeText(v.purposeRaw), filters.returnVisitKeywords)
      );
      if (firstTxAfterROF && containsAny(normalizeText(firstTxAfterROF.statusRaw), filters.canceledKeywords)) {
        breakdown.canceledFirstTxAfterRof = true;
        breakdown.canceledFirstTxPoints = 2;
      }
    }

    const totalScore = breakdown.reschedulePoints + breakdown.cancellationPoints +
      breakdown.noShowPoints + breakdown.visitGap14Points + breakdown.visitGap21Points +
      breakdown.rofNoTreatmentPoints + breakdown.canceledFirstTxPoints;

    if (totalScore === 0) continue; // No risk signal

    const riskLevel: RiskLevel = totalScore >= 6 ? 'high' : totalScore >= 3 ? 'medium' : 'low';

    const name = visits[0]?.patientName || key.replace('_', ', ');
    const provider = visits[0]?.provider || '';
    const lastDate = visits.length > 0 ? visits[visits.length - 1].date : '';

    const suggestedAction = riskLevel === 'high'
      ? 'Contact within 48 hours. Confirm next 2 appointments.'
      : riskLevel === 'medium'
      ? 'Confirm next appointment at next visit.'
      : 'Monitor.';

    patients.push({
      patientKey: key,
      patientName: name,
      provider,
      riskScore: totalScore,
      riskLevel,
      breakdown,
      lastVisitDate: lastDate,
      visitCount: visits.length,
      suggestedAction,
    });

    if (riskLevel === 'high') highRisk++;
    else if (riskLevel === 'medium') mediumRisk++;
    else lowRisk++;

    // Drivers
    if (cmrData.reschedules >= 2) drivers.repeatReschedules++;
    if (cmrData.cancellations >= 2) drivers.multipleCancellations++;
    if (breakdown.visitGap14 + breakdown.visitGap21 > 0) drivers.visitGaps14++;
    if (breakdown.rofNoTreatment) drivers.rofNoTreatment++;
  }

  patients.sort((a, b) => b.riskScore - a.riskScore);

  return {
    patients,
    highRiskCount: highRisk,
    mediumRiskCount: mediumRisk,
    lowRiskCount: lowRisk,
    riskDrivers: drivers,
  };
}
