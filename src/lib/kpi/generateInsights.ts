import type { DashboardMetrics, CarePathAnalysisResult } from "../../types/reports";
import type { ValidationReport } from "./validateReport";

export type InsightSeverity = 'high' | 'medium' | 'low';
export type InsightArea = 'do_now' | 'review_this_week' | 'process_improvements' | 'monitor_next_quarter';

export interface Insight {
  severity: InsightSeverity;
  text: string;
  action: string;
  area: InsightArea;
}

export interface InsightThresholds {
  rescheduledHigh: number;
  rofToActiveTxLow: number;
  providerDisruptionRateHigh: number;
  npToRofLow: number;
  directToMaintenanceHigh: number;
  repeatDisruptionHigh: number;
}

export const DEFAULT_THRESHOLDS: InsightThresholds = {
  rescheduledHigh: 30,
  rofToActiveTxLow: 0.65,
  providerDisruptionRateHigh: 0.25,
  npToRofLow: 0.70,
  directToMaintenanceHigh: 5,
  repeatDisruptionHigh: 3,
};

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function generateInsights(
  metrics: DashboardMetrics,
  carePath: CarePathAnalysisResult,
  validation: ValidationReport,
  thresholds: InsightThresholds = DEFAULT_THRESHOLDS
): Insight[] {
  const insights: Insight[] = [];

  // Reschedule volume
  if (metrics.rescheduledCount > thresholds.rescheduledHigh) {
    insights.push({
      severity: 'high',
      text: `Reschedule volume is elevated (${metrics.rescheduledCount} this period).`,
      action: 'Review provider-level reschedule breakdown on Providers page.',
      area: 'do_now',
    });
  }

  // ROF to active treatment
  for (const pm of carePath.providerMetrics) {
    if (pm.rofCount > 0 && pm.rofToActiveTreatmentRate < thresholds.rofToActiveTxLow) {
      insights.push({
        severity: 'medium',
        text: `Only ${pct(pm.rofToActiveTreatmentRate)} of ${pm.provider}'s ROF patients moved into active treatment.`,
        action: 'Review ROF Next 2 Visits chart on Providers page.',
        area: 'review_this_week',
      });
    }
  }

  // Provider disruption rate
  for (const d of metrics.providerDisruptions) {
    if (d.disruptionRate > thresholds.providerDisruptionRateHigh) {
      insights.push({
        severity: 'high',
        text: `${d.provider} has an elevated disruption rate (${(d.disruptionRate * 100).toFixed(1)}%).`,
        action: 'Review provider disruption breakdown.',
        area: 'do_now',
      });
    }
  }

  // NP to ROF conversion
  for (const pm of carePath.providerMetrics) {
    if (pm.newPatientCount > 0 && pm.npToRofConversionRate < thresholds.npToRofLow) {
      insights.push({
        severity: 'medium',
        text: `${pm.provider}'s New Patient → ROF conversion is ${pct(pm.npToRofConversionRate)}, below ${pct(thresholds.npToRofLow)} target.`,
        action: 'Audit ROF scheduling after new patient visits.',
        area: 'review_this_week',
      });
    }
  }

  // Direct to maintenance
  const totalDirectMaint = carePath.providerMetrics.reduce((s, p) => s + p.directToScCount + p.directToLtcCount, 0);
  if (totalDirectMaint > thresholds.directToMaintenanceHigh) {
    insights.push({
      severity: 'medium',
      text: `${totalDirectMaint} patients moved from ROF directly to SC or LTC without active treatment.`,
      action: 'Review direct-to-maintenance transitions on Providers page.',
      area: 'review_this_week',
    });
  }

  // Repeat disruptions
  if (metrics.disruptionHeavyPatients > thresholds.repeatDisruptionHigh) {
    insights.push({
      severity: 'medium',
      text: `${metrics.disruptionHeavyPatients} patients had 2+ disruption events this period.`,
      action: 'Review Patient Attention List for disruption-heavy patients.',
      area: 'review_this_week',
    });
  }

  // Validation issues
  const badFields = validation.fields.filter(f => f.confidence === 'low');
  if (badFields.length > 0) {
    insights.push({
      severity: 'low',
      text: `Data confidence note: inconsistencies found in ${badFields.map(f => f.field).join(', ')} — see Diagnostics page.`,
      action: 'Review validation report on Diagnostics page.',
      area: 'review_this_week',
    });
  }

  // Patients needing review
  if (carePath.patientsNeedingReview.length > 0) {
    insights.push({
      severity: 'high',
      text: `${carePath.patientsNeedingReview.length} patients flagged for review (progression gaps or repeated disruptions).`,
      action: 'Review Patient Attention List.',
      area: 'do_now',
    });
  }

  return insights;
}
