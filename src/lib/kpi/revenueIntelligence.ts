/**
 * Revenue Intelligence — calculates revenue metrics from posted charges.
 * 
 * IMPORTANT: Canceled visits have $0 posted charges (they never happened).
 * Revenue leakage is estimated using: canceledCount × avgCompletedCharge.
 * This is a proxy estimate, not actual revenue.
 */
import { normalizePatientKey } from '../utils/patientKey';
import { containsAny, normalizeText, safeNumber } from '../utils/normalize';
import type { EndOfDayAppointmentRow, DashboardFilters } from '@/types/reports';

export interface RevenueMetrics {
  totalPostedCharges: number;
  completedVisitCount: number;
  avgChargePerCompleted: number;
  canceledCount: number;
  estimatedCancellationLeakage: number;
  npPatientCount: number;
  npCohortRevenue: number;
  avgRevenuePerNP: number;
  // "If improved" scenario
  currentNpToRofRate: number;
  improvedNpToRofRate: number;
  additionalRofPatients: number;
  estimatedAdditionalRevenue: number;
}

export function calculateRevenueMetrics(
  appointments: EndOfDayAppointmentRow[],
  filters: DashboardFilters,
  npToRofRate: number,
  providerFilter?: string,
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

      // Track NP patient charges
      const key = normalizePatientKey(a.patientName);
      if (key !== '__unknown__') {
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

  // Estimated leakage uses avg charge as proxy for canceled visits
  const estimatedCancellationLeakage = canceledCount * avgChargePerCompleted;

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

  return {
    totalPostedCharges,
    completedVisitCount,
    avgChargePerCompleted,
    canceledCount,
    estimatedCancellationLeakage,
    npPatientCount,
    npCohortRevenue,
    avgRevenuePerNP,
    currentNpToRofRate: npToRofRate,
    improvedNpToRofRate: improvedRate,
    additionalRofPatients: Math.max(0, additionalRofPatients),
    estimatedAdditionalRevenue: Math.max(0, estimatedAdditionalRevenue),
  };
}

function parseCharge(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  // Strip $ and commas
  const cleaned = String(raw).replace(/[$,]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
