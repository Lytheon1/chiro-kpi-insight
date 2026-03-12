import { containsAny, normalizeText } from "../utils/normalize";
import { groupByWeek, getWeekLabel } from "./groupByWeek";
import type {
  ParsedEndOfDay,
  ParsedCMR,
  DashboardFilters,
  DashboardMetrics,
  EndOfDayAppointmentRow,
  CmrRow,
  ProviderDisruptionRow,
} from "../../types/reports";

export const DEFAULT_FILTERS: DashboardFilters = {
  completedKeywords: ["checked-out", "checked out", "checkedout"],
  canceledKeywords: ["canceled", "cancelled"],
  noShowKeywords: ["no show", "no-show", "noshow"],
  rescheduledKeywords: ["rescheduled", "reschedule"],
  rofKeywords: ["rof: chiro", "rof"],
  massageKeywords: ["massage"],
  newPatientKeywords: ["new patient", "np: pi", "np: wellness"],
  returnVisitKeywords: ["return visit: chiropractic", "return visit: pi"],
  reExamKeywords: ["re-exam"],
  finalEvalKeywords: ["final evaluation"],
  ptfKeywords: ["ptf"],
  supportiveCareKeywords: ["supportive care"],
  ltcKeywords: ["ltc: chiropractic", "ltc"],
  excludedPurposeKeywords: ["10-min phone", "complimentary 10-min"],
  tractionKeywords: ["spinal decompression", "traction"],
  therapyKeywords: ["therapy"],
};

export function calculateDashboardMetrics(
  endOfDay: ParsedEndOfDay,
  cmr: ParsedCMR,
  filters: DashboardFilters
): DashboardMetrics {
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

  const classify = (a: EndOfDayAppointmentRow) => {
    const status = normalizeText(a.statusRaw);
    const purpose = normalizeText(a.purposeRaw);
    return {
      isCompleted: containsAny(status, filters.completedKeywords),
      isCanceled: containsAny(status, filters.canceledKeywords),
      isNoShow: containsAny(status, filters.noShowKeywords),
      isROF: containsAny(purpose, filters.rofKeywords),
      isMassage: containsAny(purpose, filters.massageKeywords),
      isExcluded: filters.excludedPurposeKeywords?.length
        ? containsAny(purpose, filters.excludedPurposeKeywords)
        : false,
    };
  };

  // Total scheduled = all rows with completed, canceled, or no-show status
  let totalScheduled = 0, totalCompleted = 0, totalCanceled = 0, totalNoShow = 0;
  let scheduledROF = 0, completedROF = 0;
  let scheduledNonMassage = 0, completedNonMassage = 0;

  for (const a of appts) {
    const c = classify(a);
    const isScheduledDenom = c.isCompleted || c.isCanceled || c.isNoShow;
    
    // Total counts (all rows, no exclusions)
    if (isScheduledDenom) totalScheduled++;
    if (c.isCompleted) totalCompleted++;
    if (c.isCanceled) totalCanceled++;
    if (c.isNoShow) totalNoShow++;
    
    if (c.isExcluded) continue;
    if (c.isROF && isScheduledDenom) scheduledROF++;
    if (c.isROF && c.isCompleted) completedROF++;
    if (!c.isMassage && isScheduledDenom) scheduledNonMassage++;
    if (!c.isMassage && c.isCompleted) completedNonMassage++;
  }

  const weeks = (() => {
    if (filters.weeksOverride) return filters.weeksOverride;
    if (!endOfDay.minDate || !endOfDay.maxDate) return 1;
    const diff =
      (new Date(endOfDay.maxDate).getTime() -
        new Date(endOfDay.minDate).getTime()) /
      86400000;
    return Math.max(1, Math.ceil(diff / 7));
  })();

  // Report B: reschedule / cancel detail
  let rescheduledCount = 0, canceledDetailCount = 0, noShowDetailCount = 0;
  const cancelReasonMap = new Map<string, number>();
  const rescheduleReasonMap = new Map<string, number>();

  const reschByProvider = new Map<string, number>();
  const reschByApptType = new Map<string, number>();
  const reschByPatient = new Map<string, number>();

  for (const r of cmrRows) {
    const status = normalizeText(r.statusRaw);
    const reason = r.reasonRaw?.trim() || "Unspecified";

    if (containsAny(status, filters.rescheduledKeywords)) {
      rescheduledCount++;
      rescheduleReasonMap.set(reason, (rescheduleReasonMap.get(reason) ?? 0) + 1);
      const prov = r.provider || "Unknown";
      reschByProvider.set(prov, (reschByProvider.get(prov) ?? 0) + 1);
      const apptType = r.apptTypeRaw || "Unknown";
      reschByApptType.set(apptType, (reschByApptType.get(apptType) ?? 0) + 1);
      if (r.patientName) {
        const pk = r.patientName.trim().toLowerCase();
        reschByPatient.set(pk, (reschByPatient.get(pk) ?? 0) + 1);
      }
    }
    if (containsAny(status, filters.canceledKeywords)) {
      canceledDetailCount++;
      cancelReasonMap.set(reason, (cancelReasonMap.get(reason) ?? 0) + 1);
    }
    if (containsAny(status, filters.noShowKeywords)) {
      noShowDetailCount++;
    }
  }

  const sortReasons = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count }));

  const repeatRescheduledPatients = Array.from(reschByPatient.values()).filter(c => c >= 2).length;

  // Disruption-heavy patients: cancel + no-show + reschedule >= 2 from CMR
  const cmrPatientDisruptions = new Map<string, number>();
  for (const r of cmrRows) {
    if (!r.patientName) continue;
    const pk = r.patientName.trim().toLowerCase();
    const status = normalizeText(r.statusRaw);
    if (
      containsAny(status, filters.canceledKeywords) ||
      containsAny(status, filters.noShowKeywords) ||
      containsAny(status, filters.rescheduledKeywords)
    ) {
      cmrPatientDisruptions.set(pk, (cmrPatientDisruptions.get(pk) ?? 0) + 1);
    }
  }
  const disruptionHeavyPatients = Array.from(cmrPatientDisruptions.values()).filter(c => c >= 2).length;

  // Unique patients with ANY disruption
  const uniqueDisruptionPatients = cmrPatientDisruptions.size;

  // Provider disruption summary
  const providerDisruptionMap = new Map<string, { canceled: number; noShow: number; rescheduled: number; scheduledDenom: number }>();

  for (const a of appts) {
    const c = classify(a);
    const isScheduledDenom = c.isCompleted || c.isCanceled || c.isNoShow;
    if (c.isExcluded) continue;
    const prov = a.provider || "Unknown";
    if (!providerDisruptionMap.has(prov)) {
      providerDisruptionMap.set(prov, { canceled: 0, noShow: 0, rescheduled: 0, scheduledDenom: 0 });
    }
    if (isScheduledDenom) providerDisruptionMap.get(prov)!.scheduledDenom++;
    if (c.isCanceled) providerDisruptionMap.get(prov)!.canceled++;
    if (c.isNoShow) providerDisruptionMap.get(prov)!.noShow++;
  }

  for (const r of cmrRows) {
    const status = normalizeText(r.statusRaw);
    if (containsAny(status, filters.rescheduledKeywords)) {
      const prov = r.provider || "Unknown";
      if (!providerDisruptionMap.has(prov)) {
        providerDisruptionMap.set(prov, { canceled: 0, noShow: 0, rescheduled: 0, scheduledDenom: 0 });
      }
      providerDisruptionMap.get(prov)!.rescheduled++;
    }
  }

  const providerDisruptions: ProviderDisruptionRow[] = Array.from(providerDisruptionMap.entries())
    .map(([provider, d]) => {
      const total = d.canceled + d.noShow + d.rescheduled;
      return {
        provider,
        canceled: d.canceled,
        noShow: d.noShow,
        rescheduled: d.rescheduled,
        totalDisruptions: total,
        scheduledDenom: d.scheduledDenom,
        disruptionRate: d.scheduledDenom > 0 ? total / d.scheduledDenom : 0,
      };
    })
    .sort((a, b) => b.totalDisruptions - a.totalDisruptions);

  // New / Current patients
  const filteredTotals = filters.provider
    ? endOfDay.dailyTotals.filter(
        (t) => normalizeText(t.provider) === normalizeText(filters.provider!)
      )
    : endOfDay.dailyTotals;

  const newPatients = filteredTotals.reduce((s, t) => s + (t.newPatients ?? 0), 0);
  const currentPatients = filteredTotals.reduce((s, t) => s + (t.currentPatients ?? 0), 0);

  // Weekly series
  const completedNonMassageAppts = appts.filter((a) => {
    const c = classify(a);
    return !c.isMassage && !c.isExcluded && c.isCompleted;
  });

  const weeklyKept = groupByWeek(completedNonMassageAppts, (a) => a.date, () => 1);

  const canceledAppts = appts.filter((a) => {
    const c = classify(a);
    return !c.isExcluded && c.isCanceled;
  });
  const weeklyCanceled = groupByWeek(canceledAppts, (a) => a.date, () => 1);

  const noShowAppts = appts.filter((a) => {
    const c = classify(a);
    return !c.isExcluded && c.isNoShow;
  });
  const weeklyNoShow = groupByWeek(noShowAppts, (a) => a.date, () => 1);

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
  const weeklyROFRate = Array.from(rofScheduledByWeek.keys())
    .sort()
    .map((week) => ({
      week,
      value:
        (rofCompletedByWeek.get(week) ?? 0) /
        (rofScheduledByWeek.get(week) ?? 1),
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
  const weeklyRetentionRate = Array.from(retScheduledByWeek.keys())
    .sort()
    .map((week) => ({
      week,
      value:
        (retCompletedByWeek.get(week) ?? 0) /
        (retScheduledByWeek.get(week) ?? 1),
    }));

  // Weekly rescheduled from Report B
  const weeklyRescheduled = groupByWeek(
    cmrRows.filter((r) =>
      containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)
    ),
    (r) => r.date,
    () => 1
  );

  // Raw row maps by week for drill-down
  const weeklyRows = new Map<string, EndOfDayAppointmentRow[]>();
  for (const a of appts) {
    const week = getWeekLabel(a.date);
    if (!weeklyRows.has(week)) weeklyRows.set(week, []);
    weeklyRows.get(week)!.push(a);
  }

  const weeklyCmrRows = new Map<string, CmrRow[]>();
  for (const r of cmrRows) {
    const week = getWeekLabel(r.date);
    if (!weeklyCmrRows.has(week)) weeklyCmrRows.set(week, []);
    weeklyCmrRows.get(week)!.push(r);
  }

  const rescheduledByProvider = Array.from(reschByProvider.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([provider, count]) => ({ provider, count }));

  const rescheduledByApptType = Array.from(reschByApptType.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type, count }));

  return {
    totalScheduled,
    totalCompleted,
    totalCanceled,
    totalNoShow,
    completionRate: totalScheduled > 0 ? totalCompleted / totalScheduled : 0,
    scheduledROF,
    completedROF,
    rofCompletionRate: scheduledROF > 0 ? completedROF / scheduledROF : 0,
    scheduledNonMassage,
    completedNonMassage,
    retentionRate:
      scheduledNonMassage > 0 ? completedNonMassage / scheduledNonMassage : 0,
    keptNonMassage: completedNonMassage,
    avgPerWeek: completedNonMassage / weeks,
    rescheduledCount,
    canceledDetailCount,
    noShowDetailCount,
    newPatients,
    currentPatients,
    weeklyKept,
    weeklyROFRate,
    weeklyRetentionRate,
    weeklyRescheduled,
    weeklyCanceled,
    weeklyNoShow,
    topCancelReasons: sortReasons(cancelReasonMap),
    topRescheduleReasons: sortReasons(rescheduleReasonMap),
    weeklyRows,
    weeklyCmrRows,
    providerDisruptions,
    rescheduledByProvider,
    rescheduledByApptType,
    repeatRescheduledPatients,
    disruptionHeavyPatients,
    uniqueDisruptionPatients,
    totalDisruptionEvents: cmrRows.length,
  };
}
