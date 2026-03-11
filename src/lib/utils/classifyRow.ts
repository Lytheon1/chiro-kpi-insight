import { containsAny } from "./normalize";
import type { DashboardFilters } from "../../types/reports";

/**
 * Derives boolean flags for a row based on its status/purpose and the current keyword settings.
 * Applied at parse time or when keywords change.
 */
export function deriveFlags(
  statusRaw: string,
  purposeRaw: string,
  filters: DashboardFilters
) {
  const status = statusRaw.toLowerCase().trim();
  const purpose = purposeRaw.toLowerCase().trim();

  return {
    isCompleted: containsAny(status, filters.completedKeywords),
    isCanceled: containsAny(status, filters.canceledKeywords),
    isNoShow: containsAny(status, filters.noShowKeywords),
    isRescheduled: containsAny(status, filters.rescheduledKeywords),
    isROF: containsAny(purpose, filters.rofKeywords),
    isMassage: containsAny(purpose, filters.massageKeywords),
    isNewPatient: containsAny(purpose, filters.newPatientKeywords),
    isReturnVisit: containsAny(purpose, filters.returnVisitKeywords),
    isSupportiveCare: containsAny(purpose, filters.supportiveCareKeywords),
    isLTC: containsAny(purpose, filters.ltcKeywords),
    isReExam: containsAny(purpose, filters.reExamKeywords),
    isPTF: containsAny(purpose, filters.ptfKeywords),
    isFinalEval: containsAny(purpose, filters.finalEvalKeywords),
    isExcluded: filters.excludedPurposeKeywords?.length
      ? containsAny(purpose, filters.excludedPurposeKeywords)
      : false,
  };
}
