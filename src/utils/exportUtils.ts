import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { KPIMetrics, Goals, WeeklyData } from '@/types/dashboard';

export const exportToCSV = (
  metrics: KPIMetrics,
  goals: Goals,
  weeklyData: WeeklyData[],
  dateRange: { min: Date | null; max: Date | null },
  weeks: number
) => {
  const lines: string[] = [];
  
  // Header
  lines.push('CTC KPI Dashboard Export');
  lines.push(`Date Range: ${dateRange.min?.toLocaleDateString() || 'N/A'} - ${dateRange.max?.toLocaleDateString() || 'N/A'}`);
  lines.push(`Weeks: ${weeks}`);
  lines.push('');

  // Overall KPIs
  lines.push('Overall KPIs');
  lines.push('Metric,Value,Goal,Status');
  lines.push(`ROF Completion Rate,${metrics.rofCompletionRate.toFixed(1)}%,${goals.rofRate}%,${metrics.rofCompletionRate >= goals.rofRate ? 'Met' : 'Below Goal'}`);
  lines.push(`Retention Rate (excl. Massage),${metrics.retentionRate.toFixed(1)}%,${goals.retentionRate}%,${metrics.retentionRate >= goals.retentionRate ? 'Met' : 'Below Goal'}`);
  lines.push(`Total Kept Appointments,${metrics.totalKeptNonMassage},${goals.quarterlyKept},${metrics.totalKeptNonMassage >= goals.quarterlyKept ? 'Met' : 'Below Goal'}`);
  lines.push(`Weekly Average,${metrics.weeklyAverage.toFixed(1)},${goals.weeklyKept},${metrics.weeklyAverage >= goals.weeklyKept ? 'Met' : 'Below Goal'}`);
  lines.push('');

  // Weekly breakdown
  lines.push('Weekly Breakdown');
  lines.push('Week Starting,Kept Appointments,ROF Completion %,Retention %');
  weeklyData.forEach(week => {
    lines.push(`${week.weekStart},${week.keptAppointments},${week.rofCompletionRate.toFixed(1)},${week.retentionRate.toFixed(1)}`);
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `ctc-kpi-export-${new Date().toISOString().split('T')[0]}.csv`);
};

export const exportDashboardImage = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Dashboard element not found');
  }

  try {
    const dataUrl = await toPng(element, {
      quality: 0.95,
      pixelRatio: 2,
    });
    
    saveAs(dataUrl, `ctc-dashboard-${new Date().toISOString().split('T')[0]}.png`);
  } catch (error) {
    console.error('Failed to export dashboard image:', error);
    throw error;
  }
};
