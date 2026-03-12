import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { KPICards } from '@/components/dashboard/KPICards';
import { useDashboard } from '@/lib/context/DashboardContext';
import type { InsightSeverity, InsightArea } from '@/lib/kpi/generateInsights';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const severityDot: Record<InsightSeverity, string> = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted-foreground',
};

const areaLabels: Record<InsightArea, string> = {
  do_now: 'Do Now',
  review_this_week: 'Review This Week',
  process_improvements: 'Process Improvements to Consider',
  monitor_next_quarter: 'Monitor Next Quarter',
};

export default function SummaryPage() {
  const navigate = useNavigate();
  const {
    metrics, carePathAnalysis, insights, goals, effectiveWeeks, sequenceAnalysis,
  } = useDashboard();

  if (!metrics) return null;

  // Build weekly combo chart
  const allWeeks = new Set<string>();
  metrics.weeklyKept.forEach(d => allWeeks.add(d.week));
  metrics.weeklyCanceled.forEach(d => allWeeks.add(d.week));
  metrics.weeklyNoShow.forEach(d => allWeeks.add(d.week));
  metrics.weeklyRescheduled.forEach(d => allWeeks.add(d.week));

  const keptMap = new Map(metrics.weeklyKept.map(d => [d.week, d.value]));
  const cancelMap = new Map(metrics.weeklyCanceled.map(d => [d.week, d.value]));
  const noShowMap = new Map(metrics.weeklyNoShow.map(d => [d.week, d.value]));
  const reschMap = new Map(metrics.weeklyRescheduled.map(d => [d.week, d.value]));

  const weeklyComboChart = Array.from(allWeeks).sort().map(week => ({
    week,
    kept: keptMap.get(week) ?? 0,
    canceled: cancelMap.get(week) ?? 0,
    noShow: noShowMap.get(week) ?? 0,
    rescheduled: reschMap.get(week) ?? 0,
  }));

  const weeklyROFChart = metrics.weeklyROFRate.map(d => ({
    week: d.week,
    rofCompletionRate: d.value * 100,
  }));

  // Group insights by area
  const doNow = insights.filter(i => i.severity === 'high');
  const reviewWeek = insights.filter(i => i.severity === 'medium');
  const lowSeverity = insights.filter(i => i.severity === 'low');

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards
        metrics={metrics}
        goals={goals}
        weeks={effectiveWeeks}
        patientsNeedingReviewCount={carePathAnalysis?.patientsNeedingReview.length}
        onNeedsReviewClick={() => navigate('/patients')}
      />

      {/* Unexpected Next Step card */}
      {sequenceAnalysis && sequenceAnalysis.totalNPPatients > 0 && (
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/providers')}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Unexpected Next Step After New Patient</div>
              <div className="text-2xl font-bold">{sequenceAnalysis.unexpectedNextStepCount}</div>
              <div className="text-xs text-muted-foreground">
                {(sequenceAnalysis.unexpectedNextStepPct * 100).toFixed(0)}% of NP patients — next visit was not ROF
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Insights Panel */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              What the data is showing this period
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  These insights are generated automatically from your uploaded data. They highlight operational patterns — not clinical judgments.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.slice(0, 6).map((insight, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot[insight.severity]}`} />
                  <div>
                    <div className="text-sm">{insight.text}</div>
                    <div className="text-xs text-muted-foreground">{insight.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Game Plan</CardTitle>
          <CardDescription>Prioritized actions based on this period's data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GamePlanColumn title="Do Now" items={[
              ...doNow.map(i => i.text),
              'Review Patients Needing Review list on Patient Attention page.',
            ]} color="destructive" />
            <GamePlanColumn title="Review This Week" items={[
              ...reviewWeek.map(i => i.text),
              'Audit ROF → active treatment progression on Provider page.',
            ]} color="warning" />
            <GamePlanColumn title="Process Improvements" items={[
              'Review booking flow after ROF to ensure treatment start is confirmed.',
              'Standardize visit-type labeling in ChiroTouch for cleaner reporting.',
              ...(sequenceAnalysis && sequenceAnalysis.unexpectedNextStepPct > 0.3
                ? ['Consider confirming ROF scheduling before New Patient visit ends.']
                : []),
            ]} color="primary" />
            <GamePlanColumn title="Monitor Next Quarter" items={[
              'Reschedule rate trend',
              'ROF-to-treatment progression',
              'Provider-level disruption',
              'Maintenance-only patient patterns',
            ]} color="muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic">
            This game plan is generated from operational patterns in the uploaded reports.
            Recommendations are scheduling and workflow observations — not clinical directives.
          </p>
        </CardContent>
      </Card>

      {/* Summary Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {weeklyComboChart.length > 0 && (
          <Card className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate('/trends')}>
            <CardHeader>
              <CardTitle className="text-base">Weekly Kept Appointments</CardTitle>
              <CardDescription>Click to see detailed trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={weeklyComboChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <ReferenceLine y={goals.weeklyKept} stroke="hsl(var(--success))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="kept" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Kept" dot={false} />
                  <Line type="monotone" dataKey="canceled" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="5 5" name="Canceled" dot={false} opacity={0.5} />
                  <Line type="monotone" dataKey="noShow" stroke="hsl(var(--warning))" strokeWidth={1} strokeDasharray="5 5" name="No-Show" dot={false} opacity={0.5} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {weeklyROFChart.length > 0 && (
          <Card className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate('/trends')}>
            <CardHeader>
              <CardTitle className="text-base">ROF Completion Rate</CardTitle>
              <CardDescription>Click to see detailed trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={weeklyROFChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 100]} />
                  <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
                  <ReferenceLine y={goals.rofRate} stroke="hsl(var(--success))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="rofCompletionRate" stroke="hsl(var(--secondary))" strokeWidth={2.5} name="ROF %" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function GamePlanColumn({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-semibold text-${color}`}>{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 bg-${color}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
