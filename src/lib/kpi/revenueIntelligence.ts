/**
 * Revenue Intelligence — calculates revenue metrics using configurable avg visit value.
 * 
 * Posted charges are NOT used because they don't reflect actual collections
 * (plan totals, decompression bundles, ROF plan values inflate the numbers).
 * All estimates use the user-configurable average visit value (default $120).
 */
import { normalizePatientKey } from '../utils/patientKey';
import { containsAny, normalizeText } from '../utils/normalize';
import type { EndOfDayAppointmentRow, DashboardFilters } from '@/types/reports';

export const DEFAULT_AVG_VISIT_VALUE = 120;

export interface RevenueMetrics {
  completedVisitCount: number;
  configuredAvgVisitValue: number;
  canceledCount: number;
  estimatedCancellationLeakage: number;
  weeklyLeakage: number;
  weeklyLeakageVisits: number;
  npPatientCount: number;
  avgRevenuePerNP: number;
  // "If improved" scenario
  currentNpToRofRate: number;
  improvedNpToRofRate: number;
  additionalRofPatients: number;
  estimatedAdditionalRevenue: number;
  // Lifetime Patient Value Opportunity
  lifetimeOpportunity: LifetimeOpportunity;
}

export interface LifetimeOpportunity {
  avgVisitsPerRetainedPatient: number;
  avgRevenuePerRetainedPatient: number;
  lostNpToRofPatients: number;
  lostRofToTxPatients: number;
  totalLostPatients: number;
  estimatedAnnualLoss: number;
  estimatedAnnualLossLow: number;
  estimatedAnnualLossHigh: number;
  narrative: string;
}

export function calculateRevenueMetrics(
  appointments: EndOfDayAppointmentRow[],
  filters: DashboardFilters,
  npToRofRate: number,
  providerFilter?: string,
  avgVisitValue: number = DEFAULT_AVG_VISIT_VALUE,
  effectiveWeeks: number = 13,
  funnelData?: { npPatientCount: number; rofPatientCount: number; txStartedCount: number },
): RevenueMetrics {
  const appts = providerFilter
    ? appointments.filter(a => normalizeText(a.provider) === normalizeText(providerFilter))
    : appointments;

  let completedVisitCount = 0;
  let canceledCount = 0;

  const npPatientKeys = new Set<string>();
  const patientVisitCounts = new Map<string, number>();

  for (const a of appts) {
    const status = normalizeText(a.statusRaw);
    const purpose = normalizeText(a.purposeRaw);
    const isCompleted = containsAny(status, filters.completedKeywords);
    const isCanceled = containsAny(status, filters.canceledKeywords);
    const isMassage = containsAny(purpose, filters.massageKeywords);
    const isExcluded = filters.excludedPurposeKeywords?.length
      ? containsAny(purpose, filters.excludedPurposeKeywords)
      : false;

    if (isCompleted) {
      completedVisitCount++;
      const key = normalizePatientKey(a.patientName);
      if (key !== '__unknown__') {
        patientVisitCounts.set(key, (patientVisitCounts.get(key) ?? 0) + 1);
      }
    }

    if (isCanceled && !isMassage && !isExcluded) {
      canceledCount++;
    }

    if (containsAny(purpose, filters.newPatientKeywords)) {
      const key = normalizePatientKey(a.patientName);
      if (key !== '__unknown__') npPatientKeys.add(key);
    }
  }

  // All leakage uses configurable avg visit value — NOT posted charges
  const estimatedCancellationLeakage = canceledCount * avgVisitValue;
  const weeklyLeakage = effectiveWeeks > 0 ? estimatedCancellationLeakage / effectiveWeeks : 0;
  const weeklyLeakageVisits = effectiveWeeks > 0 ? canceledCount / effectiveWeeks : 0;

  const npPatientCount = npPatientKeys.size;
  // NP revenue estimate uses configurable value (NP visits are typically higher value)
  const npVisitPremium = 1.8; // NPs typically ~1.8x a regular visit
  const avgRevenuePerNP = avgVisitValue * npVisitPremium;

  // "If improved" scenario
  const improvedRate = 0.75;
  const additionalRofPatients = Math.round(npPatientCount * (improvedRate - npToRofRate));
  const estimatedAdditionalRevenue = additionalRofPatients > 0
    ? additionalRofPatients * avgRevenuePerNP
    : 0;

  // ─── Lifetime Patient Value Opportunity ───
  let retainedPatientCount = 0;
  let retainedVisitTotal = 0;
  for (const [, count] of patientVisitCounts) {
    if (count >= 3) {
      retainedPatientCount++;
      retainedVisitTotal += count;
    }
  }
  const avgVisitsPerRetained = retainedPatientCount > 0
    ? retainedVisitTotal / retainedPatientCount
    : 8;

  const avgRevenuePerRetained = avgVisitsPerRetained * avgVisitValue;

  const lostNpToRof = funnelData
    ? funnelData.npPatientCount - funnelData.rofPatientCount
    : Math.round(npPatientCount * (1 - npToRofRate));
  const lostRofToTx = funnelData
    ? funnelData.rofPatientCount - funnelData.txStartedCount
    : 0;
  const totalLost = lostNpToRof + lostRofToTx;

  const quarterMultiplier = 4;
  const annualLoss = totalLost * avgRevenuePerRetained * quarterMultiplier;
  const annualLossLow = Math.round(annualLoss * 0.7);
  const annualLossHigh = Math.round(annualLoss * 1.3);

  const narrative = totalLost > 0
    ? `${totalLost} patients per quarter drop out before completing care. ` +
      `If retained, each would average ~${avgVisitsPerRetained.toFixed(0)} visits × $${avgVisitValue} = ~$${avgRevenuePerRetained.toLocaleString()} per patient. ` +
      `Annualized, this represents ~$${Math.round(annualLoss).toLocaleString()} in unrealized revenue.`
    : 'No significant patient drop-off detected.';

  const lifetimeOpportunity: LifetimeOpportunity = {
    avgVisitsPerRetainedPatient: avgVisitsPerRetained,
    avgRevenuePerRetainedPatient: avgRevenuePerRetained,
    lostNpToRofPatients: Math.max(0, lostNpToRof),
    lostRofToTxPatients: Math.max(0, lostRofToTx),
    totalLostPatients: Math.max(0, totalLost),
    estimatedAnnualLoss: Math.round(annualLoss),
    estimatedAnnualLossLow: annualLossLow,
    estimatedAnnualLossHigh: annualLossHigh,
    narrative,
  };

  return {
    completedVisitCount,
    configuredAvgVisitValue: avgVisitValue,
    canceledCount,
    estimatedCancellationLeakage,
    weeklyLeakage: Math.round(weeklyLeakage),
    weeklyLeakageVisits: Math.round(weeklyLeakageVisits * 10) / 10,
    npPatientCount,
    avgRevenuePerNP,
    currentNpToRofRate: npToRofRate,
    improvedNpToRofRate: improvedRate,
    additionalRofPatients: Math.max(0, additionalRofPatients),
    estimatedAdditionalRevenue: Math.max(0, estimatedAdditionalRevenue),
    lifetimeOpportunity,
  };
}
