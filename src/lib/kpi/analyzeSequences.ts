import { containsAny, normalizeText } from "../utils/normalize";
import type { EndOfDayAppointmentRow, DashboardFilters } from "../../types/reports";

export interface NPNextStepResult {
  category: string;
  count: number;
  pctOfCohort: number;
  patients: Array<{ name: string; provider: string; npDate: string; nextDate?: string; nextType?: string; hadDisruptionBeforeStep?: boolean }>;
  note?: string;
}

export interface ROFPathResult {
  path: string;
  count: number;
  patients: Array<{ name: string; provider: string; rofDate: string; visit1?: string; visit2?: string }>;
}

export interface SequenceAnalysisResult {
  npNextSteps: NPNextStepResult[];
  rofPaths: ROFPathResult[];
  totalNPPatients: number;
  totalROFPatients: number;
  unexpectedNextStepCount: number;
  unexpectedNextStepPct: number;
  duplicateNPCount: number;
}

/**
 * Build patient journeys: group by name, sort chronologically.
 * When providerFilter is active, only include that provider's visits.
 */
function buildPatientJourneys(
  rows: EndOfDayAppointmentRow[],
  providerFilter?: string
): Map<string, EndOfDayAppointmentRow[]> {
  const filtered = providerFilter
    ? rows.filter(r => r.provider.toLowerCase().trim() === providerFilter.toLowerCase().trim())
    : rows;

  const map = new Map<string, EndOfDayAppointmentRow[]>();
  for (const row of filtered) {
    const key = row.patientName?.trim().toLowerCase() || '__unknown__';
    if (key === '__unknown__') continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  for (const [, visits] of map) {
    visits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  return map;
}

function classifyVisitType(purposeRaw: string, filters: DashboardFilters): string {
  const p = normalizeText(purposeRaw);
  if (containsAny(p, filters.rofKeywords)) return 'ROF';
  if (containsAny(p, filters.newPatientKeywords)) return 'New Patient';
  if (filters.tractionKeywords && containsAny(p, filters.tractionKeywords)) return 'Traction';
  if (filters.therapyKeywords && containsAny(p, filters.therapyKeywords)) return 'Therapy';
  if (containsAny(p, filters.returnVisitKeywords)) return 'Return Visit / Active Treatment';
  if (containsAny(p, filters.reExamKeywords)) return 'Re-Exam';
  if (containsAny(p, filters.finalEvalKeywords)) return 'Final Eval';
  if (containsAny(p, filters.ptfKeywords)) return 'PTF';
  if (containsAny(p, filters.supportiveCareKeywords)) return 'Supportive Care';
  if (containsAny(p, filters.ltcKeywords)) return 'LTC';
  if (containsAny(p, filters.massageKeywords)) return 'Massage';
  return 'Other';
}

function isActiveTreatment(purposeRaw: string, filters: DashboardFilters): boolean {
  const p = normalizeText(purposeRaw);
  return containsAny(p, filters.returnVisitKeywords) ||
    (filters.tractionKeywords ? containsAny(p, filters.tractionKeywords) : false) ||
    (filters.therapyKeywords ? containsAny(p, filters.therapyKeywords) : false);
}

function isNearPeriodEnd(date: string, periodEndDate: string | undefined, days = 14): boolean {
  if (!periodEndDate) return false;
  const d = new Date(date).getTime();
  const end = new Date(periodEndDate).getTime();
  return (end - d) / 86400000 <= days;
}

function isCompleted(row: EndOfDayAppointmentRow, filters: DashboardFilters): boolean {
  return containsAny(normalizeText(row.statusRaw), filters.completedKeywords);
}

function isDisrupted(row: EndOfDayAppointmentRow, filters: DashboardFilters): boolean {
  const s = normalizeText(row.statusRaw);
  return containsAny(s, filters.canceledKeywords) ||
    containsAny(s, filters.noShowKeywords) ||
    containsAny(s, filters.rescheduledKeywords);
}

function isNP(purposeRaw: string, filters: DashboardFilters): boolean {
  return containsAny(normalizeText(purposeRaw), filters.newPatientKeywords);
}

export function analyzeSequences(
  appointments: EndOfDayAppointmentRow[],
  filters: DashboardFilters,
  periodEndDate?: string
): SequenceAnalysisResult {
  const journeys = buildPatientJourneys(appointments, filters.provider);

  // ─── NP Next Meaningful Step ─────────────────────────────────────────────
  const npNextMap = new Map<string, NPNextStepResult>();
  let totalNP = 0;
  let unexpectedCount = 0;
  let duplicateNPCount = 0;

  for (const [patientKey, visits] of journeys) {
    // Find first NP visit
    const npIdx = visits.findIndex(v => isNP(v.purposeRaw, filters));
    if (npIdx === -1) continue;
    totalNP++;

    const npVisit = visits[npIdx];
    const afterNP = visits.slice(npIdx + 1);

    let category: string;
    let nextDate: string | undefined;
    let nextType: string | undefined;
    let hadDisruptionBefore = false;

    // Find next meaningful step: skip disrupted duplicate NP rows
    let meaningfulVisit: EndOfDayAppointmentRow | undefined;
    let disruptionsBeforeMeaningful = 0;

    for (const v of afterNP) {
      const vType = classifyVisitType(v.purposeRaw, filters);

      // A disrupted row (canceled/no-show/rescheduled) — note it but skip
      if (isDisrupted(v, filters)) {
        disruptionsBeforeMeaningful++;
        continue;
      }

      // A completed duplicate NP — likely rebooking artifact
      if (vType === 'New Patient' && isCompleted(v, filters)) {
        duplicateNPCount++;
        // Don't use as meaningful next step — skip it
        continue;
      }

      // This is the meaningful next completed visit
      meaningfulVisit = v;
      break;
    }

    if (!meaningfulVisit) {
      if (isNearPeriodEnd(npVisit.date, periodEndDate)) {
        category = 'Quarter-Boundary — No Next Visit Yet';
      } else if (disruptionsBeforeMeaningful > 0) {
        category = 'Disruption Only — No Completed Follow-Up';
        unexpectedCount++;
      } else {
        category = 'No Next Visit in Period';
        unexpectedCount++;
      }
    } else {
      const stepType = classifyVisitType(meaningfulVisit.purposeRaw, filters);
      hadDisruptionBefore = disruptionsBeforeMeaningful > 0;

      if (stepType === 'ROF' && hadDisruptionBefore) {
        category = 'Disruption Before ROF';
        // Still reached ROF — not unexpected
      } else if (stepType === 'ROF') {
        category = 'ROF';
      } else {
        category = stepType;
        unexpectedCount++;
      }

      nextDate = meaningfulVisit.date;
      nextType = meaningfulVisit.purposeRaw;
    }

    if (!npNextMap.has(category)) {
      npNextMap.set(category, { category, count: 0, pctOfCohort: 0, patients: [] });
    }
    const entry = npNextMap.get(category)!;
    entry.count++;
    entry.patients.push({
      name: npVisit.patientName || patientKey,
      provider: npVisit.provider,
      npDate: npVisit.date,
      nextDate,
      nextType,
      hadDisruptionBeforeStep: hadDisruptionBefore,
    });
  }

  // Compute pctOfCohort and add notes
  for (const [, entry] of npNextMap) {
    entry.pctOfCohort = totalNP > 0 ? entry.count / totalNP : 0;
    if (entry.category === 'Disruption Before ROF') {
      entry.note = `${entry.count} patients had disruption events before reaching ROF`;
    }
  }

  // If there were duplicate NPs detected, add a diagnostics entry
  if (duplicateNPCount > 0) {
    const dupeEntry: NPNextStepResult = {
      category: 'Duplicate / Rebooked NP',
      count: duplicateNPCount,
      pctOfCohort: totalNP > 0 ? duplicateNPCount / totalNP : 0,
      patients: [],
      note: 'Completed NP visits that appeared after an initial NP — likely rebooking or intake artifact. Excluded from next-step classification.',
    };
    npNextMap.set('Duplicate / Rebooked NP', dupeEntry);
  }

  // ─── ROF Next 2 Visits ──────────────────────────────────────────────────
  const rofPathMap = new Map<string, ROFPathResult>();
  let totalROF = 0;

  for (const [patientKey, visits] of journeys) {
    const rofIdx = visits.findIndex(v =>
      containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
    );
    if (rofIdx === -1) continue;
    totalROF++;

    const rofVisit = visits[rofIdx];
    const afterROF = visits.slice(rofIdx + 1);
    const completedAfter = afterROF.filter(v => isCompleted(v, filters));

    let pathLabel: string;
    let visit1Type: string | undefined;
    let visit2Type: string | undefined;

    if (completedAfter.length === 0) {
      const hasDisruptions = afterROF.some(v => isDisrupted(v, filters));

      if (isNearPeriodEnd(rofVisit.date, periodEndDate)) {
        pathLabel = 'ROF → No Next Visit (Quarter Boundary)';
      } else if (hasDisruptions) {
        pathLabel = 'ROF → Disruption → No Later Completed';
      } else {
        pathLabel = 'ROF → No Next Visit';
      }
    } else {
      const v1 = completedAfter[0];
      visit1Type = classifyVisitType(v1.purposeRaw, filters);

      if (completedAfter.length >= 2) {
        const v2 = completedAfter[1];
        visit2Type = classifyVisitType(v2.purposeRaw, filters);
        pathLabel = `ROF → ${visit1Type} → ${visit2Type}`;
      } else {
        pathLabel = `ROF → ${visit1Type}`;
      }

      if ((visit1Type === 'Supportive Care' || visit1Type === 'LTC') && !isActiveTreatment(v1.purposeRaw, filters)) {
        pathLabel = `ROF → ${visit1Type} (Direct)`;
      }
    }

    if (!rofPathMap.has(pathLabel)) {
      rofPathMap.set(pathLabel, { path: pathLabel, count: 0, patients: [] });
    }
    const entry = rofPathMap.get(pathLabel)!;
    entry.count++;
    entry.patients.push({
      name: rofVisit.patientName || patientKey,
      provider: rofVisit.provider,
      rofDate: rofVisit.date,
      visit1: visit1Type,
      visit2: visit2Type,
    });
  }

  const npNextSteps = Array.from(npNextMap.values()).sort((a, b) => b.count - a.count);
  const rofPaths = Array.from(rofPathMap.values()).sort((a, b) => b.count - a.count);

  return {
    npNextSteps,
    rofPaths,
    totalNPPatients: totalNP,
    totalROFPatients: totalROF,
    unexpectedNextStepCount: unexpectedCount,
    unexpectedNextStepPct: totalNP > 0 ? unexpectedCount / totalNP : 0,
    duplicateNPCount,
  };
}
