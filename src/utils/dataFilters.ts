import { AppointmentRow, Keywords, KPIMetrics } from '@/types/dashboard';
import { isCompleted, isMassage, isScheduled } from './kpiCalculator';

/**
 * Pre-filter and cache appointment categories to avoid multiple filter passes
 */
export interface FilteredAppointments {
  completedNonMassage: AppointmentRow[];
  scheduledNonMassage: AppointmentRow[];
  totalRows: number;
}

export const preFilterAppointments = (
  rows: AppointmentRow[],
  keywords: Keywords
): FilteredAppointments => {
  const completedNonMassage: AppointmentRow[] = [];
  const scheduledNonMassage: AppointmentRow[] = [];

  rows.forEach(row => {
    const isNonMassage = !isMassage(row, keywords);
    const scheduled = isScheduled(row, keywords);
    const completed = isCompleted(row, keywords);

    if (isNonMassage && completed) {
      completedNonMassage.push(row);
    }
    
    if (isNonMassage && scheduled) {
      scheduledNonMassage.push(row);
    }
  });

  return {
    completedNonMassage,
    scheduledNonMassage,
    totalRows: rows.length,
  };
};
