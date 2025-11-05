import { AppointmentRow, Keywords, KPIMetrics } from '@/types/dashboard';
import { isCompleted, isExcluded, isScheduled } from './kpiCalculator';

/**
 * Pre-filter and cache appointment categories to avoid multiple filter passes
 */
export interface FilteredAppointments {
  completedNonExcluded: AppointmentRow[];
  scheduledNonExcluded: AppointmentRow[];
  totalRows: number;
}

export const preFilterAppointments = (
  rows: AppointmentRow[],
  keywords: Keywords
): FilteredAppointments => {
  const completedNonExcluded: AppointmentRow[] = [];
  const scheduledNonExcluded: AppointmentRow[] = [];

  rows.forEach(row => {
    const isNonExcluded = !isExcluded(row, keywords);
    const scheduled = isScheduled(row, keywords);
    const completed = isCompleted(row, keywords);

    if (isNonExcluded && completed) {
      completedNonExcluded.push(row);
    }
    
    if (isNonExcluded && scheduled) {
      scheduledNonExcluded.push(row);
    }
  });

  return {
    completedNonExcluded,
    scheduledNonExcluded,
    totalRows: rows.length,
  };
};
