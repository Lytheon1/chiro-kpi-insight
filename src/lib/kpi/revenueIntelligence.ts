/**
 * Revenue Intelligence — calculates revenue metrics.
 * 
 * Two leakage views:
 *   1. "Billed value foregone" uses avgPostedChargePerVisit (from posted charges or configurable avg)
 *   2. "Est. collected value lost" uses a weighted-average reimbursement estimate (~$128)
 *      that reflects what the clinic actually collects after insurance adjustments.
 */
import { normalizePatientKey } from '../utils/patientKey';
import { containsAny, normalizeText } from '../utils/normalize';
import type { EndOfDayAppointmentRow, DashboardFilters } from '@/types/reports';

export const DEFAULT_AVG_VISIT_VALUE = 120;

/**
 * Weighted-average reimbursement per visit, based on typical chiro payer mix:
 *   Return visit ~$105, Therapy ~$140, NP ~$250, Decompression ~$120,
 *   LTC/SC ~$105, PI ~$150.
 * Blended average ≈ $128.
 */
export const AVG_REIMBURSEMENT_PER_VISIT = 128;
export const REIMBURSEMENT_RANGE_LOW_MULT = 0.78;  // ~$100
export const REIMBURSEMENT_RANGE_HIGH_MULT = 1.25;  // ~$160

export interface RevenueMetrics {
  completedVisitCount: number;
  /** The configurable avg visit value (posted/billed proxy) */
  avgPostedChargePerVisit: number;
  canceledCount: number;
  /** Billed value foregone (posted charge proxy) */
  billedLeakage: number;
  /** Estimated collected value lost (reimbursement-based) */
  collectedLeakage: number;
  collectedLeakageLow: number;
  collectedLeakageHigh: number;
  /** Weekly reimbursement-based leakage */
  weeklyCollectedLeakage: number;
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
  effectiveWeeks: number;
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

  // Billed value foregone (posted charge proxy)
  const billedLeakage = canceledCount * avgVisitValue;

  // Reimbursement-based leakage (what the clinic actually loses)
  const collectedLeakage = canceledCount * AVG_REIMBURSEMENT_PER_VISIT;
  const collectedLeakageLow = Math.round(canceledCount * AVG_REIMBURSEMENT_PER_VISIT * REIMBURSEMENT_RANGE_LOW_MULT);
  const collectedLeakageHigh = Math.round(canceledCount * AVG_REIMBURSEMENT_PER_VISIT * REIMBURSEMENT_RANGE_HIGH_MULT);

  const weeklyCollectedLeakage = effectiveWeeks > 0 ? Math.round(collectedLeakage / effectiveWeeks) : 0;
  const weeklyLeakageVisits = effectiveWeeks > 0 ? canceledCount / effectiveWeeks : 0;

  const npPatientCount = npPatientKeys.size;
  const npVisitPremium = 1.8;
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

  // Lifetime uses reimbursement, not posted charges
  const avgRevenuePerRetained = avgVisitsPerRetained * AVG_REIMBURSEMENT_PER_VISIT;

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
      `If retained, each would average ~${avgVisitsPerRetained.toFixed(0)} visits × $${AVG_REIMBURSEMENT_PER_VISIT} avg reimbursement = ~$${avgRevenuePerRetained.toLocaleString()} per patient. ` +
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
    avgPostedChargePerVisit: avgVisitValue,
    canceledCount,
    billedLeakage,
    collectedLeakage: Math.round(collectedLeakage),
    collectedLeakageLow,
    collectedLeakageHigh,
    weeklyCollectedLeakage,
    weeklyLeakageVisits: Math.round(weeklyLeakageVisits * 10) / 10,
    npPatientCount,
    avgRevenuePerNP,
    currentNpToRofRate: npToRofRate,
    improvedNpToRofRate: improvedRate,
    additionalRofPatients: Math.max(0, additionalRofPatients),
    estimatedAdditionalRevenue: Math.max(0, estimatedAdditionalRevenue),
    lifetimeOpportunity,
    effectiveWeeks,
  };
}
