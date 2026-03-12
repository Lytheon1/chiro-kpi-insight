/**
 * Revenue Intelligence — calculates revenue metrics from posted charges.
 * 
 * KEY DESIGN DECISION: Average visit value for leakage estimation is
 * user-configurable (default $120) because posted charges often include
 * treatment plan totals, decompression bundles, and ROF plan values that
 * inflate the per-visit average far beyond realistic reimbursement (~$100-140).
 * 
 * The "posted charges" total is still shown as-is from the data.
 * Leakage estimation uses the configurable average instead.
 */
import { normalizePatientKey } from '../utils/patientKey';
import { containsAny, normalizeText } from '../utils/normalize';
import type { EndOfDayAppointmentRow, DashboardFilters } from '@/types/reports';

export const DEFAULT_AVG_VISIT_VALUE = 120;

export interface RevenueMetrics {
  totalPostedCharges: number;
  completedVisitCount: number;
  avgChargePerCompleted: number;       // raw from data (likely inflated)
  configuredAvgVisitValue: number;     // user-set realistic value
  canceledCount: number;
  estimatedCancellationLeakage: number; // uses configuredAvgVisitValue
  weeklyLeakage: number;               // leakage / weeks
  weeklyLeakageVisits: number;         // canceled / weeks
  npPatientCount: number;
  npCohortRevenue: number;
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

  let totalPostedCharges = 0;
  let completedVisitCount = 0;
  let canceledCount = 0;

  // Track NP cohort revenue
  const npPatientCharges = new Map<string, number>();
  const npPatientKeys = new Set<string>();
  // Track retained patient visit counts (patients with 3+ completed visits)
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
      const charge = parseCharge(a.postedChargesRaw);
      totalPostedCharges += charge;

      // Track per-patient visit counts and charges
      const key = normalizePatientKey(a.patientName);
      if (key !== '__unknown__') {
        patientVisitCounts.set(key, (patientVisitCounts.get(key) ?? 0) + 1);
        if (!npPatientCharges.has(key)) npPatientCharges.set(key, 0);
        npPatientCharges.set(key, npPatientCharges.get(key)! + charge);
      }
    }

    if (isCanceled && !isMassage && !isExcluded) {
      canceledCount++;
    }

    // Track NP patients
    if (containsAny(purpose, filters.newPatientKeywords)) {
      const key = normalizePatientKey(a.patientName);
      if (key !== '__unknown__') npPatientKeys.add(key);
    }
  }

  const avgChargePerCompleted = completedVisitCount > 0
    ? totalPostedCharges / completedVisitCount
    : 0;

  // Use configurable avg visit value for leakage — NOT the inflated posted charge average
  const estimatedCancellationLeakage = canceledCount * avgVisitValue;
  const weeklyLeakage = effectiveWeeks > 0 ? estimatedCancellationLeakage / effectiveWeeks : 0;
  const weeklyLeakageVisits = effectiveWeeks > 0 ? canceledCount / effectiveWeeks : 0;

  // NP cohort revenue
  let npCohortRevenue = 0;
  for (const key of npPatientKeys) {
    npCohortRevenue += npPatientCharges.get(key) || 0;
  }
  const npPatientCount = npPatientKeys.size;
  const avgRevenuePerNP = npPatientCount > 0 ? npCohortRevenue / npPatientCount : 0;

  // "If improved" scenario
  const improvedRate = 0.75;
  const additionalRofPatients = Math.round(npPatientCount * (improvedRate - npToRofRate));
  const estimatedAdditionalRevenue = additionalRofPatients > 0
    ? additionalRofPatients * avgRevenuePerNP
    : 0;

  // ─── Lifetime Patient Value Opportunity ───
  // Calculate avg visits and revenue for retained patients (3+ visits)
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
    : 8; // fallback estimate

  const avgRevenuePerRetained = avgVisitsPerRetained * avgVisitValue;

  // How many patients are lost at each stage
  const lostNpToRof = funnelData
    ? funnelData.npPatientCount - funnelData.rofPatientCount
    : Math.round(npPatientCount * (1 - npToRofRate));
  const lostRofToTx = funnelData
    ? funnelData.rofPatientCount - funnelData.txStartedCount
    : 0;
  const totalLost = lostNpToRof + lostRofToTx;

  // Annualize: multiply quarterly loss by 4
  const quarterMultiplier = 4;
  const annualLoss = totalLost * avgRevenuePerRetained * quarterMultiplier;
  // Range: ±30% for low/high estimates
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
    totalPostedCharges,
    completedVisitCount,
    avgChargePerCompleted,
    configuredAvgVisitValue: avgVisitValue,
    canceledCount,
    estimatedCancellationLeakage,
    weeklyLeakage: Math.round(weeklyLeakage),
    weeklyLeakageVisits: Math.round(weeklyLeakageVisits * 10) / 10,
    npPatientCount,
    npCohortRevenue,
    avgRevenuePerNP,
    currentNpToRofRate: npToRofRate,
    improvedNpToRofRate: improvedRate,
    additionalRofPatients: Math.max(0, additionalRofPatients),
    estimatedAdditionalRevenue: Math.max(0, estimatedAdditionalRevenue),
    lifetimeOpportunity,
  };
}

function parseCharge(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[$,]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
