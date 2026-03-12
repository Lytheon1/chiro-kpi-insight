import { KPICard } from '@/components/KPICard';
import type { DashboardMetrics } from '@/types/reports';

interface Goals {
  rofRate: number;
  retentionRate: number;
  quarterlyKept: number;
  weeklyKept: number;
}

interface KPICardsProps {
  metrics: DashboardMetrics;
  goals: Goals;
  weeks: number;
  patientsNeedingReviewCount?: number;
  onNeedsReviewClick?: () => void;
}

const getStatus = (value: number, goal: number, isPercentage: boolean): 'success' | 'warning' | 'error' => {
  if (isPercentage) {
    if (value >= goal) return 'success';
    if (value >= goal * 0.9) return 'warning';
    return 'error';
  }
  if (value >= goal) return 'success';
  if (value >= goal * 0.85) return 'warning';
  return 'error';
};

export const KPICards = ({ metrics, goals, weeks, patientsNeedingReviewCount, onNeedsReviewClick }: KPICardsProps) => {
  const rofPct = metrics.rofCompletionRate * 100;
  const retPct = metrics.retentionRate * 100;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <KPICard
        title="ROF Completion Rate"
        value={`${rofPct.toFixed(1)}%`}
        goal={`${goals.rofRate}%`}
        status={getStatus(rofPct, goals.rofRate, true)}
        subtitle={`${metrics.completedROF} of ${metrics.scheduledROF} ROF appts`}
        variance={`${rofPct >= goals.rofRate ? '+' : ''}${(rofPct - goals.rofRate).toFixed(1)}% vs goal`}
      />
      <KPICard
        title="Retention Rate"
        value={`${retPct.toFixed(1)}%`}
        goal={`${goals.retentionRate}%`}
        status={getStatus(retPct, goals.retentionRate, true)}
        subtitle="Excluding massage"
        variance={`${retPct >= goals.retentionRate ? '+' : ''}${(retPct - goals.retentionRate).toFixed(1)}% vs goal`}
      />
      <KPICard
        title="Total Kept (ex-massage)"
        value={metrics.keptNonMassage}
        goal={goals.quarterlyKept}
        status={getStatus(metrics.keptNonMassage, goals.quarterlyKept, false)}
        subtitle={`For ${weeks} week period`}
        variance={`${metrics.keptNonMassage >= goals.quarterlyKept ? '+' : ''}${metrics.keptNonMassage - goals.quarterlyKept} vs goal`}
      />
      <KPICard
        title="Weekly Average"
        value={metrics.avgPerWeek.toFixed(1)}
        goal={goals.weeklyKept}
        status={getStatus(metrics.avgPerWeek, goals.weeklyKept, false)}
        subtitle="Kept appts per week"
        variance={`${metrics.avgPerWeek >= goals.weeklyKept ? '+' : ''}${(metrics.avgPerWeek - goals.weeklyKept).toFixed(1)} vs goal`}
      />
      <KPICard
        title="Rescheduled"
        value={metrics.rescheduledCount}
        subtitle="From Report B only"
      />
      <KPICard
        title="New Patients"
        value={metrics.newPatients}
        subtitle="From daily totals"
      />
      <KPICard
        title="Current Patients"
        value={metrics.currentPatients}
        subtitle="From daily totals"
      />
      {patientsNeedingReviewCount !== undefined && (
        <KPICard
          title="Patients Needing Review"
          value={patientsNeedingReviewCount}
          subtitle="Possible progression gap or disruptions"
          onClick={onNeedsReviewClick}
        />
      )}
    </div>
  );
};
