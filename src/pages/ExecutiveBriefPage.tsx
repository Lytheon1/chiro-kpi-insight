import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ArrowRight, ShieldCheck, ShieldAlert, Calendar } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { useDashboard } from '@/lib/context/DashboardContext';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { METRIC_KEYS } from '@/types/evidence';
import type { InsightSeverity } from '@/lib/kpi/generateInsights';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
};

const severityDot: Record<InsightSeverity, string> = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted-foreground',
};

export default function ExecutiveBriefPage() {
  const navigate = useNavigate();
  const {
    metrics, carePathAnalysis, insights, goals, effectiveWeeks,
    sequenceAnalysis, validationReport, evidenceStore, endOfDay, allProviders,
  } = useDashboard();
  const singleProvider = allProviders.length <= 1;

  if (!metrics) return null;

  // Charts
  const allWeeks = new Set<string>();
  metrics.weeklyKept.forEach(d => allWeeks.add(d.week));
  metrics.weeklyCanceled.forEach(d => allWeeks.add(d.week));
  metrics.weeklyNoShow.forEach(d => allWeeks.add(d.week));

  const keptMap = new Map(metrics.weeklyKept.map(d => [d.week, d.value]));
  const cancelMap = new Map(metrics.weeklyCanceled.map(d => [d.week, d.value]));
  const noShowMap = new Map(metrics.weeklyNoShow.map(d => [d.week, d.value]));

  const weeklyComboChart = Array.from(allWeeks).sort().map(week => ({
    week, kept: keptMap.get(week) ?? 0, canceled: cancelMap.get(week) ?? 0, noShow: noShowMap.get(week) ?? 0,
  }));

  const weeklyROFChart = metrics.weeklyROFRate.map(d => ({ week: d.week, rofCompletionRate: d.value * 100 }));

  const doNow = insights.filter(i => i.severity === 'high');
  const reviewWeek = insights.filter(i => i.severity === 'medium');

  const totalRows = endOfDay?.appointments.length ?? 0;
  const overallConf = validationReport?.overallConfidence ?? 'high';
  const confLabel = overallConf === 'high' ? 'high' : overallConf === 'review' ? 'medium' : 'low';
  const confVariance = validationReport?.fields.reduce((max, f) => Math.max(max, f.pctDifference), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Brief Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">
          {singleProvider && allProviders[0] ? `${allProviders[0]} — Operations Brief` : 'Clinic Operations Brief'}
        </h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {endOfDay?.minDate} — {endOfDay?.maxDate}</span>
          <span>Reports loaded: 2</span>
          <span>Generated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricCard
          label="ROF Completion"
          value={`${(metrics.rofCompletionRate * 100).toFixed(1)}%`}
          sub={`${metrics.completedROF}/${metrics.scheduledROF}`}
          goal={goals.rofRate}
          actual={metrics.rofCompletionRate * 100}
          evidence={evidenceStore[METRIC_KEYS.ROF_COMPLETION_RATE]}
        />
        <MetricCard
          label="Retention Rate"
          value={`${(metrics.retentionRate * 100).toFixed(1)}%`}
          sub="Excl. massage"
          goal={goals.retentionRate}
          actual={metrics.retentionRate * 100}
          evidence={evidenceStore[METRIC_KEYS.RETENTION_RATE]}
        />
        <MetricCard
          label="Total Kept"
          value={metrics.keptNonMassage}
          sub={`${effectiveWeeks}wk period`}
          goal={goals.quarterlyKept}
          actual={metrics.keptNonMassage}
          evidence={evidenceStore[METRIC_KEYS.TOTAL_KEPT]}
        />
        <MetricCard
          label="Weekly Avg"
          value={metrics.avgPerWeek.toFixed(1)}
          sub="Kept/week"
          goal={goals.weeklyKept}
          actual={metrics.avgPerWeek}
        />
        <MetricCard
          label="Rescheduled"
          value={metrics.rescheduledCount}
          sub="Report B"
          evidence={evidenceStore[METRIC_KEYS.RESCHEDULED_COUNT]}
        />
        <MetricCard
          label="New Patients"
          value={metrics.newPatients}
          sub="Daily totals"
          evidence={evidenceStore[METRIC_KEYS.NEW_PATIENTS]}
        />
        <MetricCard
          label="Current Patients"
          value={metrics.currentPatients}
          sub="Daily totals"
        />
        {carePathAnalysis && (
          <div
            className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={() => navigate('/patients')}
          >
            <div className="text-[10px] text-muted-foreground mb-1">Needs Review</div>
            <div className="text-xl font-bold">{carePathAnalysis.patientsNeedingReview.length}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              Click to review <ArrowRight className="h-2.5 w-2.5" />
            </div>
          </div>
        )}
      </div>

      {/* Unexpected Next Step */}
      {sequenceAnalysis && sequenceAnalysis.totalNPPatients > 0 && sequenceAnalysis.unexpectedNextStepCount > 0 && (
        <Card className="cursor-pointer hover:bg-accent/20 transition-colors border-warning/30" onClick={() => navigate('/analysis')}>
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Unexpected Next Step After New Patient</div>
              <div className="text-lg font-bold">{sequenceAnalysis.unexpectedNextStepCount}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({(sequenceAnalysis.unexpectedNextStepPct * 100).toFixed(0)}% of NP patients)
                </span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Key Findings */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {insights.slice(0, 5).map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${severityDot[insight.severity]}`} />
                  <div>
                    <span>{insight.text}</span>
                    <span className="text-muted-foreground ml-1 text-xs">— {insight.action}</span>
                  </div>
                </div>
              ))}
              {insights.length > 5 && (
                <div className="text-xs text-muted-foreground pt-1">{insights.length - 5} more findings available</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight">Game Plan</CardTitle>
          <CardDescription className="text-xs">Prioritized actions derived from this period's data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ActionBucket title="Do Now" severity="high" items={[
              ...doNow.map(i => i.text),
              'Review Patients Needing Review list.',
            ]} />
            <ActionBucket title="Review This Week" severity="medium" items={[
              ...reviewWeek.map(i => i.text),
              'Audit ROF → active treatment progression.',
            ]} />
            <ActionBucket title="Monitor" severity="low" items={[
              'Reschedule rate trend',
              'ROF-to-treatment progression',
              'Provider-level disruption patterns',
              'Maintenance-only patient volume',
            ]} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 italic">
            These are operational observations — not clinical directives.
          </p>
        </CardContent>
      </Card>

      {/* Data Confidence Summary */}
      <Card>
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <ConfidenceBadge confidence={confLabel as any} />
          <span className="text-xs text-muted-foreground">
            {totalRows.toLocaleString()} visits analyzed.
            {confVariance < 3
              ? ' Totals reconciled within 2%.'
              : confVariance < 10
              ? ` Max variance ${confVariance.toFixed(1)}% — review source data.`
              : ` Significant variance detected (${confVariance.toFixed(1)}%) — see Validation page.`}
          </span>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {weeklyComboChart.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Weekly Kept Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyComboChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-[10px]" />
                  <YAxis className="text-[10px]" />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <ReferenceLine y={goals.weeklyKept} stroke="hsl(var(--success))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="kept" stroke="hsl(var(--primary))" strokeWidth={2} name="Kept" dot={false} />
                  <Line type="monotone" dataKey="canceled" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="4 4" name="Canceled" dot={false} opacity={0.4} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {weeklyROFChart.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">ROF Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyROFChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-[10px]" />
                  <YAxis className="text-[10px]" domain={[0, 100]} />
                  <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
                  <ReferenceLine y={goals.rofRate} stroke="hsl(var(--success))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="rofCompletionRate" stroke="hsl(var(--secondary))" strokeWidth={2} name="ROF %" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, goal, actual, evidence }: {
  label: string; value: string | number; sub?: string;
  goal?: number; actual?: number; evidence?: any;
}) {
  const isAboveGoal = goal !== undefined && actual !== undefined && actual >= goal;
  const statusColor = goal === undefined ? '' :
    isAboveGoal ? 'border-success/30' : actual! >= goal * 0.9 ? 'border-warning/30' : 'border-destructive/30';

  return (
    <div className={`p-3 rounded-lg border bg-card ${statusColor}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        {evidence && <ConfidenceBadge evidence={evidence} compact />}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      {goal !== undefined && (
        <div className={`text-[10px] font-medium mt-0.5 ${isAboveGoal ? 'text-success' : 'text-destructive'}`}>
          Goal: {goal}
        </div>
      )}
    </div>
  );
}

function ActionBucket({ title, severity, items }: { title: string; severity: 'high' | 'medium' | 'low'; items: string[] }) {
  const color = severity === 'high' ? 'border-l-destructive' : severity === 'medium' ? 'border-l-warning' : 'border-l-muted-foreground';
  return (
    <div className={`border-l-2 ${color} pl-3 space-y-1.5`}>
      <h4 className="text-xs font-semibold">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-muted-foreground leading-tight">{item}</li>
        ))}
      </ul>
    </div>
  );
}
