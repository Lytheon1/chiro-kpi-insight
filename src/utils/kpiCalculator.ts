import { AppointmentRow, Keywords, KPIMetrics, Goals, WeeklyData } from '@/types/dashboard';

const normalizeString = (str: string | undefined): string => {
  if (!str) return '';
  return str.toString().trim().replace(/\s+/g, ' ').toLowerCase();
};

export const isCompleted = (row: AppointmentRow, keywords: Keywords): boolean => {
  return (row._statusNormalized || '').includes(normalizeString(keywords.completed));
};

export const isCanceled = (row: AppointmentRow, keywords: Keywords): boolean => {
  return (row._statusNormalized || '').includes(normalizeString(keywords.canceled));
};

export const isNoShow = (row: AppointmentRow, keywords: Keywords): boolean => {
  return (row._statusNormalized || '').includes(normalizeString(keywords.noShow));
};

export const isROF = (row: AppointmentRow, keywords: Keywords): boolean => {
  return (row._purposeNormalized || '').includes(normalizeString(keywords.rof));
};

export const isMassage = (row: AppointmentRow, keywords: Keywords): boolean => {
  return (row._purposeNormalized || '').includes(normalizeString(keywords.massageExclude));
};

export const isScheduled = (row: AppointmentRow, keywords: Keywords): boolean => {
  return isCompleted(row, keywords) || isCanceled(row, keywords) || isNoShow(row, keywords);
};

export const calculateKPIs = (
  rows: AppointmentRow[],
  keywords: Keywords,
  weeks: number
): KPIMetrics => {
  const scheduledROF = rows.filter(r => isROF(r, keywords) && isScheduled(r, keywords)).length;
  const completedROF = rows.filter(r => isROF(r, keywords) && isCompleted(r, keywords)).length;
  
  const scheduledNonMassage = rows.filter(r => !isMassage(r, keywords) && isScheduled(r, keywords)).length;
  const completedNonMassage = rows.filter(r => !isMassage(r, keywords) && isCompleted(r, keywords)).length;

  const rofCompletionRate = scheduledROF > 0 ? (completedROF / scheduledROF) * 100 : 0;
  const retentionRate = scheduledNonMassage > 0 ? (completedNonMassage / scheduledNonMassage) * 100 : 0;
  const weeklyAverage = weeks > 0 ? completedNonMassage / weeks : 0;

  console.log('KPI Calculation Debug:', {
    totalRows: rows.length,
    weeks,
    scheduledROF,
    completedROF,
    scheduledNonMassage,
    completedNonMassage,
    weeklyAverage: weeklyAverage.toFixed(2),
  });

  return {
    scheduledROF,
    completedROF,
    rofCompletionRate,
    scheduledNonMassage,
    completedNonMassage,
    retentionRate,
    totalKeptNonMassage: completedNonMassage,
    weeklyAverage,
  };
};

export const getKPIStatus = (
  value: number,
  goal: number,
  isPercentage: boolean = false
): 'success' | 'warning' | 'error' => {
  if (isPercentage) {
    if (value >= goal) return 'success';
    if (value >= goal * 0.9) return 'warning';
    return 'error';
  } else {
    if (value >= goal) return 'success';
    if (value >= goal * 0.85) return 'warning';
    return 'error';
  }
};

export const calculateWeeklyData = (
  rows: AppointmentRow[],
  keywords: Keywords,
  dateRange: { min: Date | null; max: Date | null }
): WeeklyData[] => {
  if (!dateRange.min || !dateRange.max) return [];

  const weeklyMap = new Map<string, AppointmentRow[]>();
  
  rows.forEach(row => {
    if (!row.date) return;
    
    const date = row.date instanceof Date ? row.date : new Date(row.date);
    if (isNaN(date.getTime())) return;

    // Get start of week (Monday)
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(date.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, []);
    }
    weeklyMap.get(weekKey)!.push(row);
  });

  const weeklyData: WeeklyData[] = [];
  
  weeklyMap.forEach((weekRows, weekStart) => {
    const completedNonMassage = weekRows.filter(r => 
      !isMassage(r, keywords) && isCompleted(r, keywords)
    ).length;

    const scheduledROF = weekRows.filter(r => 
      isROF(r, keywords) && isScheduled(r, keywords)
    ).length;
    const completedROF = weekRows.filter(r => 
      isROF(r, keywords) && isCompleted(r, keywords)
    ).length;

    const scheduledNonMassage = weekRows.filter(r => 
      !isMassage(r, keywords) && isScheduled(r, keywords)
    ).length;
    const completedNonMassageForRate = weekRows.filter(r => 
      !isMassage(r, keywords) && isCompleted(r, keywords)
    ).length;

    weeklyData.push({
      weekStart,
      keptAppointments: completedNonMassage,
      rofCompletionRate: scheduledROF > 0 ? (completedROF / scheduledROF) * 100 : 0,
      retentionRate: scheduledNonMassage > 0 ? (completedNonMassageForRate / scheduledNonMassage) * 100 : 0,
    });
  });

  return weeklyData.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
};
