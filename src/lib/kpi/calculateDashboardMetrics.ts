import { containsAny, normalizeText } from "../utils/normalize";
import { groupByWeek, getWeekLabel } from "./groupByWeek";
import type {
  ParsedEndOfDay,
  ParsedCMR,
  DashboardFilters,
  DashboardMetrics,
  EndOfDayAppointmentRow,
  CmrRow,
} from "../../types/reports";

export const DEFAULT_FILTERS: DashboardFilters = {
  completedKeywords:     ["checked-out", "checked out", "checkedout"],
  canceledKeywords:      ["canceled", "cancelled"],
  noShowKeywords:        ["no show", "no-show", "noshow"],
  rescheduledKeywords:   ["rescheduled", "reschedule"],
  rofKeywords:           ["rof", "report of findings"],
  massageKeywords:       ["massage"],
  excludedPurposeKeywords: [],
};

export function calculateDashboardMetrics(
  endOfDay: ParsedEndOfDay,
  cmr: ParsedCMR,
  filters: DashboardFilters
): DashboardMetrics {
  // ── Filter appointments by provider
  const appts: EndOfDayAppointmentRow[] = filters.provider
    ? endOfDay.appointments.filter(
        (a) => normalizeText(a.provider) === normalizeText(filters.provider!)
      )
    : endOfDay.appointments;

  const cmrRows: CmrRow[] = filters.provider
    ? cmr.rows.filter(
        (r) => normalizeText(r.provider ?? "") === normalizeText(filters.provider!)
      )
    : cmr.rows;

  // ── Appointment classifiers
  const classify = (a: EndOfDayAppointmentRow) => {
    const status = normalizeText(a.statusRaw);
    const purpose = normalizeText(a.purposeRaw);
    return {
      isCompleted:  containsAny(status, filters.completedKeywords),
      isCanceled:   containsAny(status, filters.canceledKeywords),
      isNoShow:     containsAny(status, filters.noShowKeywords),
      isROF:        containsAny(purpose, filters.rofKeywords),
      isMassage:    containsAny(purpose, filters.massageKeywords),
      isExcluded:   filters.excludedPurposeKeywords?.length
                    ? containsAny(purpose, filters.excludedPurposeKeywords)
                    : false,
    };
  };

  // ── Main KPI calculations — Report A only
  let scheduledROF = 0, completedROF = 0;
  let scheduledNonMassage = 0, completedNonMassage = 0;

  for (const a of appts) {
    const c = classify(a);
    const isScheduledDenom = c.isCompleted || c.isCanceled || c.isNoShow;
    if (c.isExcluded) continue;

    if (c.isROF && isScheduledDenom) scheduledROF++;
    if (c.isROF && c.isCompleted)    completedROF++;
    if (!c.isMassage && isScheduledDenom) scheduledNonMassage++;
    if (!c.isMassage && c.isCompleted)    completedNonMassage++;
  }

  // ── Weeks calculation
  const weeks = (() => {
    if (filters.weeksOverride) return filters.weeksOverride;
    if (!endOfDay.minDate || !endOfDay.maxDate) return 1;
    const diff = (new Date(endOfDay.maxDate).getTime() - new Date(endOfDay.minDate).getTime()) / 86400000;
    return Math.max(1, Math.ceil(diff / 7));
  })();

  // ── Reschedule / cancel detail — Report B only
  let rescheduledCount = 0, canceledDetailCount = 0;
  const cancelReasonMap = new Map<string, number>();
  const rescheduleReasonMap = new Map<string, number>();

  for (const r of cmrRows) {
    const status = normalizeText(r.statusRaw);
    const reason = r.reasonRaw?.trim() || "Unspecified";

    if (containsAny(status, filters.rescheduledKeywords)) {
      rescheduledCount++;
      rescheduleReasonMap.set(reason, (rescheduleReasonMap.get(reason) ?? 0) + 1);
    }
    if (containsAny(status, filters.canceledKeywords)) {
      canceledDetailCount++;
      cancelReasonMap.set(reason, (cancelReasonMap.get(reason) ?? 0) + 1);
    }
  }

  const sortReasons = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count }));

  // ── New / Current patients — from Report A daily totals
  const filteredTotals = filters.provider
    ? endOfDay.dailyTotals.filter(
        (t) => normalizeText(t.provider) === normalizeText(filters.provider!)
      )
    : endOfDay.dailyTotals;

  const newPatients = filteredTotals.reduce((s, t) => s + (t.newPatients ?? 0), 0);
  const currentPatients = filteredTotals.reduce((s, t) => s + (t.currentPatients ?? 0), 0);

  // ── Weekly series
  const completedNonMassageAppts = appts.filter((a) => {
    const c = classify(a);
    return !c.isMassage && !c.isExcluded && c.isCompleted;
  });

  const weeklyKept = groupByWeek(completedNonMassageAppts, (a) => a.date, () => 1);

  // Weekly ROF rate
  const rofScheduledByWeek = new Map<string, number>();
  const rofCompletedByWeek = new Map<string, number>();
  for (const a of appts) {
    const c = classify(a);
    if (c.isExcluded || !c.isROF) continue;
    const week = getWeekLabel(a.date);
    if (c.isCompleted || c.isCanceled || c.isNoShow)
      rofScheduledByWeek.set(week, (rofScheduledByWeek.get(week) ?? 0) + 1);
    if (c.isCompleted)
      rofCompletedByWeek.set(week, (rofCompletedByWeek.get(week) ?? 0) + 1);
  }
  const weeklyROFRate = Array.from(rofScheduledByWeek.keys()).sort().map((week) => ({
    week,
    value: (rofCompletedByWeek.get(week) ?? 0) / (rofScheduledByWeek.get(week) ?? 1),
  }));

  // Weekly retention rate
  const retScheduledByWeek = new Map<string, number>();
  const retCompletedByWeek = new Map<string, number>();
  for (const a of appts) {
    const c = classify(a);
    if (c.isExcluded || c.isMassage) continue;
    const week = getWeekLabel(a.date);
    if (c.isCompleted || c.isCanceled || c.isNoShow)
      retScheduledByWeek.set(week, (retScheduledByWeek.get(week) ?? 0) + 1);
    if (c.isCompleted)
      retCompletedByWeek.set(week, (retCompletedByWeek.get(week) ?? 0) + 1);
  }
  const weeklyRetentionRate = Array.from(retScheduledByWeek.keys()).sort().map((week) => ({
    week,
    value: (retCompletedByWeek.get(week) ?? 0) / (retScheduledByWeek.get(week) ?? 1),
  }));

  // Weekly rescheduled from Report B
  const weeklyRescheduled = groupByWeek(
    cmrRows.filter((r) => containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)),
    (r) => r.date,
    () => 1
  );

  return {
    scheduledROF,
    completedROF,
    rofCompletionRate: scheduledROF > 0 ? completedROF / scheduledROF : 0,
    scheduledNonMassage,
    completedNonMassage,
    retentionRate: scheduledNonMassage > 0 ? completedNonMassage / scheduledNonMassage : 0,
    keptNonMassage: completedNonMassage,
    avgPerWeek: completedNonMassage / weeks,
    rescheduledCount,
    canceledDetailCount,
    newPatients,
    currentPatients,
    weeklyKept,
    weeklyROFRate,
    weeklyRetentionRate,
    weeklyRescheduled,
    topCancelReasons: sortReasons(cancelReasonMap),
    topRescheduleReasons: sortReasons(rescheduleReasonMap),
  };
}
