import { containsAny, normalizeText } from "../utils/normalize";
import type {
  EndOfDayAppointmentRow,
  CmrRow,
  DashboardFilters,
  CarePathClassification,
  PatientJourney,
  ProviderCarePathMetrics,
  CarePathAnalysisResult,
} from "../../types/reports";

/**
 * Groups appointments by patient name, sorts chronologically, then classifies
 * each patient's care path progression.
 */
export function analyzeCarePathIntegrity(
  appointments: EndOfDayAppointmentRow[],
  cmrRows: CmrRow[],
  filters: DashboardFilters,
  periodEndDate?: string
): CarePathAnalysisResult {
  // Count how many rows lack patient names
  const totalRows = appointments.length;
  const missingNames = appointments.filter(
    (a) => !a.patientName || a.patientName.trim() === ""
  ).length;
  const missingNamePercentage = totalRows > 0 ? (missingNames / totalRows) * 100 : 0;
  const isPathAnalysisReliable = missingNamePercentage < 10;

  // Build patient journeys from Report A
  const journeyMap = new Map<string, EndOfDayAppointmentRow[]>();
  for (const row of appointments) {
    const key = row.patientName?.trim().toLowerCase() || "__unknown__";
    if (key === "__unknown__") continue;
    if (!journeyMap.has(key)) journeyMap.set(key, []);
    journeyMap.get(key)!.push(row);
  }

  // Sort each patient's visits chronologically
  for (const [, visits] of journeyMap) {
    visits.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  // Build CMR disruption counts per patient
  const cmrDisruptions = new Map<string, number>();
  for (const r of cmrRows) {
    const key = r.patientName?.trim().toLowerCase() || "__unknown__";
    if (key === "__unknown__") continue;
    const status = normalizeText(r.statusRaw);
    if (
      containsAny(status, filters.canceledKeywords) ||
      containsAny(status, filters.noShowKeywords) ||
      containsAny(status, filters.rescheduledKeywords)
    ) {
      cmrDisruptions.set(key, (cmrDisruptions.get(key) ?? 0) + 1);
    }
  }

  const journeys: PatientJourney[] = [];

  for (const [patientKey, visits] of journeyMap) {
    const provider =
      visits.find((v) => v.provider)?.provider || "Unknown";

    // Classify visits
    const hasROF = visits.some((v) =>
      containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
    );
    const hasNP = visits.some((v) =>
      containsAny(normalizeText(v.purposeRaw), filters.newPatientKeywords)
    );
    const hasSC = visits.some((v) =>
      containsAny(normalizeText(v.purposeRaw), filters.supportiveCareKeywords)
    );
    const hasLTC = visits.some((v) =>
      containsAny(normalizeText(v.purposeRaw), filters.ltcKeywords)
    );
    const hasActiveTreatment = visits.some((v) => {
      const p = normalizeText(v.purposeRaw);
      return containsAny(p, filters.returnVisitKeywords) ||
        (filters.tractionKeywords ? containsAny(p, filters.tractionKeywords) : false) ||
        (filters.therapyKeywords ? containsAny(p, filters.therapyKeywords) : false) ||
        containsAny(p, filters.reExamKeywords) ||
        containsAny(p, filters.finalEvalKeywords);
    });

    // Count disruptions from Report A statuses + CMR
    let disruptions = 0;
    for (const v of visits) {
      const s = normalizeText(v.statusRaw);
      if (
        containsAny(s, filters.canceledKeywords) ||
        containsAny(s, filters.noShowKeywords) ||
        containsAny(s, filters.rescheduledKeywords)
      ) {
        disruptions++;
      }
    }
    disruptions += cmrDisruptions.get(patientKey) ?? 0;

    // Find ROF date for boundary check
    const rofVisit = visits.find((v) =>
      containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
    );
    const rofDate = rofVisit ? new Date(rofVisit.date) : null;
    const endDate = periodEndDate
      ? new Date(periodEndDate)
      : new Date(visits[visits.length - 1].date);

    // Has any visit after ROF?
    const visitsAfterROF = rofVisit
      ? visits.filter(
          (v) =>
            new Date(v.date).getTime() > rofDate!.getTime() &&
            v !== rofVisit
        )
      : [];
    const hasFollowUp = visitsAfterROF.length > 0;
    const hasActiveTreatmentAfterROF = visitsAfterROF.some((v) => {
      const p = normalizeText(v.purposeRaw);
      return containsAny(p, filters.returnVisitKeywords) ||
        (filters.tractionKeywords ? containsAny(p, filters.tractionKeywords) : false) ||
        (filters.therapyKeywords ? containsAny(p, filters.therapyKeywords) : false) ||
        containsAny(p, filters.reExamKeywords) ||
        containsAny(p, filters.finalEvalKeywords);
    });
    const goesDirectToSC = !hasActiveTreatmentAfterROF &&
      visitsAfterROF.some((v) =>
        containsAny(normalizeText(v.purposeRaw), filters.supportiveCareKeywords)
      );
    const goesDirectToLTC = !hasActiveTreatmentAfterROF &&
      visitsAfterROF.some((v) =>
        containsAny(normalizeText(v.purposeRaw), filters.ltcKeywords)
      );

    // Classification (first match wins)
    let classification: CarePathClassification = "needs_review";
    const secondaryFlags: CarePathClassification[] = [];

    // Check if patient has active treatment AND maintenance (full progression)
    const hasMaintenanceAfterTx = hasActiveTreatment && (hasSC || hasLTC) && hasROF;

    // Rule 1b: Full progression: ROF → Active Treatment → SC/LTC = maintenance achieved
    if (hasROF && hasActiveTreatmentAfterROF && (hasSC || hasLTC)) {
      classification = "maintenance_phase_only";
    }
    // Rule 2: First visible visit is SC/LTC, no ROF — ongoing maintenance patient
    else if (
      !hasROF &&
      (containsAny(normalizeText(visits[0].purposeRaw), filters.supportiveCareKeywords) ||
        containsAny(normalizeText(visits[0].purposeRaw), filters.ltcKeywords))
    ) {
      classification = "maintenance_phase_only";
    }
    // Rule 2b: No ROF, but has active treatment + SC/LTC = maintenance patient
    else if (!hasROF && hasActiveTreatment && (hasSC || hasLTC)) {
      classification = "maintenance_phase_only";
    }
    // Rule 3: ROF near end, no follow-up
    else if (
      hasROF &&
      rofDate &&
      (endDate.getTime() - rofDate.getTime()) / 86400000 <= 14 &&
      !hasFollowUp
    ) {
      classification = "quarter_boundary_unclear";
    }
    // Rule 4: ROF + active treatment follows
    else if (hasROF && hasActiveTreatmentAfterROF) {
      classification = "progressed_as_expected";
    }
    // Rule 5: ROF → SC/LTC direct, no active treatment
    else if (hasROF && (goesDirectToSC || goesDirectToLTC)) {
      classification = "possible_progression_gap";
    }
    // Rule 6: ROF but no downstream visits
    else if (hasROF && !hasFollowUp) {
      classification = "possible_progression_gap";
    }

    // Rule 7: Disruption heavy as secondary flag
    if (disruptions >= 2) {
      secondaryFlags.push("disruption_heavy");
    }

    journeys.push({
      patientName: visits[0].patientName || patientKey,
      provider,
      visits,
      classification,
      secondaryFlags,
      disruptionCount: disruptions,
    });
  }

  // Patients needing review
  const patientsNeedingReview = journeys.filter(
    (j) =>
      j.classification === "possible_progression_gap" ||
      j.secondaryFlags.includes("disruption_heavy") ||
      j.disruptionCount >= 2
  );

  const maintenanceOnlyCount = journeys.filter(
    (j) => j.classification === "maintenance_phase_only"
  ).length;

  const quarterBoundaryUnclearCount = journeys.filter(
    (j) => j.classification === "quarter_boundary_unclear"
  ).length;

  // Per-provider metrics
  const providerJourneys = new Map<string, PatientJourney[]>();
  for (const j of journeys) {
    if (!providerJourneys.has(j.provider))
      providerJourneys.set(j.provider, []);
    providerJourneys.get(j.provider)!.push(j);
  }

  const providerMetrics: ProviderCarePathMetrics[] = [];
  for (const [provider, pJourneys] of providerJourneys) {
    const npCount = pJourneys.filter((j) =>
      j.visits.some((v) =>
        containsAny(normalizeText(v.purposeRaw), filters.newPatientKeywords)
      )
    ).length;

    const rofCount = pJourneys.filter((j) =>
      j.visits.some((v) =>
        containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
      )
    ).length;

    const rofJourneys = pJourneys.filter((j) =>
      j.visits.some((v) =>
        containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
      )
    );

    const rofWithActiveTx = rofJourneys.filter(
      (j) => j.classification === "progressed_as_expected"
    ).length;

    const directToSc = rofJourneys.filter(
      (j) =>
        j.classification === "possible_progression_gap" &&
        j.visits.some((v) =>
          containsAny(
            normalizeText(v.purposeRaw),
            filters.supportiveCareKeywords
          )
        )
    ).length;

    const directToLtc = rofJourneys.filter(
      (j) =>
        j.classification === "possible_progression_gap" &&
        j.visits.some((v) =>
          containsAny(normalizeText(v.purposeRaw), filters.ltcKeywords)
        )
    ).length;

    const rofNoFollow = rofJourneys.filter(
      (j) => j.classification === "possible_progression_gap"
    ).length;

    const npToRofRate = npCount > 0 ? rofCount / npCount : 0;
    const rofToActiveTxRate =
      rofCount > 0 ? rofWithActiveTx / rofCount : 0;
    const directToMaintenanceRate =
      rofCount > 0 ? (directToSc + directToLtc) / rofCount : 0;

    // Score: base = (npToRofRate * 0.35) + (rofToActiveTxRate * 0.50)
    // penalty = directToMaintenanceRate * 0.15
    const base = npToRofRate * 0.35 + rofToActiveTxRate * 0.5;
    const penalty = directToMaintenanceRate * 0.15;
    const score = Math.round(
      Math.max(0, Math.min(100, (base - penalty) * 100))
    );

    const classificationCounts: Record<CarePathClassification, number> = {
      progressed_as_expected: 0,
      maintenance_phase_only: 0,
      possible_progression_gap: 0,
      quarter_boundary_unclear: 0,
      disruption_heavy: 0,
      needs_review: 0,
    };
    for (const j of pJourneys) {
      classificationCounts[j.classification]++;
      for (const f of j.secondaryFlags) {
        classificationCounts[f]++;
      }
    }

    providerMetrics.push({
      provider,
      newPatientCount: npCount,
      rofCount,
      npToRofConversionRate: npToRofRate,
      rofToActiveTreatmentRate: rofToActiveTxRate,
      directToScCount: directToSc,
      directToLtcCount: directToLtc,
      rofNoFollowThroughCount: rofNoFollow,
      carePathIntegrityScore: score,
      classificationCounts,
    });
  }

  return {
    journeys,
    providerMetrics,
    patientsNeedingReview,
    maintenanceOnlyCount,
    quarterBoundaryUnclearCount,
    missingNamePercentage,
    isPathAnalysisReliable,
  };
}
