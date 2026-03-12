import { containsAny, normalizeText } from "../utils/normalize";
import type { EndOfDayAppointmentRow, DashboardFilters } from "../../types/reports";

export interface NPNextStepResult {
  category: string;
  count: number;
  patients: Array<{ name: string; provider: string; npDate: string; nextDate?: string; nextType?: string }>;
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
}

/**
 * Build patient journeys: group by name, sort chronologically.
 */
function buildPatientJourneys(rows: EndOfDayAppointmentRow[]): Map<string, EndOfDayAppointmentRow[]> {
  const map = new Map<string, EndOfDayAppointmentRow[]>();
  for (const row of rows) {
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

export function analyzeSequences(
  appointments: EndOfDayAppointmentRow[],
  filters: DashboardFilters,
  periodEndDate?: string
): SequenceAnalysisResult {
  const journeys = buildPatientJourneys(appointments);

  // NP Next Step Analysis
  const npNextMap = new Map<string, NPNextStepResult>();
  let totalNP = 0;
  let unexpectedCount = 0;

  for (const [patientKey, visits] of journeys) {
    // Find first NP visit in period
    const npIdx = visits.findIndex(v =>
      containsAny(normalizeText(v.purposeRaw), filters.newPatientKeywords)
    );
    if (npIdx === -1) continue;
    totalNP++;

    const npVisit = visits[npIdx];
    const nextVisits = visits.slice(npIdx + 1);

    let category: string;
    let nextDate: string | undefined;
    let nextType: string | undefined;

    if (nextVisits.length === 0) {
      if (isNearPeriodEnd(npVisit.date, periodEndDate)) {
        category = 'Quarter-Boundary — No Next Visit Yet';
      } else {
        category = 'No Next Visit in Period';
        unexpectedCount++;
      }
    } else {
      const nextVisit = nextVisits[0];
      category = classifyVisitType(nextVisit.purposeRaw, filters);
      nextDate = nextVisit.date;
      nextType = nextVisit.purposeRaw;
      if (category !== 'ROF') {
        unexpectedCount++;
      }
    }

    if (!npNextMap.has(category)) {
      npNextMap.set(category, { category, count: 0, patients: [] });
    }
    const entry = npNextMap.get(category)!;
    entry.count++;
    entry.patients.push({
      name: npVisit.patientName || patientKey,
      provider: npVisit.provider,
      npDate: npVisit.date,
      nextDate,
      nextType,
    });
  }

  // ROF Next 2 Visits Analysis
  const rofPathMap = new Map<string, ROFPathResult>();
  let totalROF = 0;

  for (const [patientKey, visits] of journeys) {
    const rofIdx = visits.findIndex(v =>
      containsAny(normalizeText(v.purposeRaw), filters.rofKeywords)
    );
    if (rofIdx === -1) continue;
    totalROF++;

    const rofVisit = visits[rofIdx];
    // Find next 2 completed visits after ROF, skip canceled/no-show
    const afterROF = visits.slice(rofIdx + 1);
    const completedAfter = afterROF.filter(v => isCompleted(v, filters));

    let pathLabel: string;
    let visit1Type: string | undefined;
    let visit2Type: string | undefined;

    if (completedAfter.length === 0) {
      // Check for disruptions in between
      const hasDisruptions = afterROF.some(v => {
        const s = normalizeText(v.statusRaw);
        return containsAny(s, filters.canceledKeywords) ||
          containsAny(s, filters.noShowKeywords) ||
          containsAny(s, filters.rescheduledKeywords);
      });

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

      // Check for direct-to-maintenance flags
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
  };
}
