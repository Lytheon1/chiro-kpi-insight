/**
 * Executive Brief — "Doctor View" page.
 * Designed to be understandable in 10 seconds.
 * Shows: Health Score → Three Questions → Funnel → Insights → Risk + Revenue → Game Plan → Charts
 */
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HelpCircle, ArrowRight, Calendar, ChevronDown, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { useDashboard } from '@/lib/context/DashboardContext';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { METRIC_KEYS } from '@/types/evidence';
import { STATUS_COLORS, STATUS_BG, STATUS_LABELS, BENCHMARKS, getBenchmarkStatus } from '@/lib/kpi/benchmarks';
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

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ExecutiveBriefPage() {
  const navigate = useNavigate();
  const {
    metrics, carePathAnalysis, insights, goals, effectiveWeeks,
    sequenceAnalysis, validationReport, evidenceStore, endOfDay, allProviders,
    patientFunnel, patientRisk, revenueMetrics, clinicHealthScore,
  } = useDashboard();
  const singleProvider = allProviders.length <= 1;
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [healthBreakdownOpen, setHealthBreakdownOpen] = useState(false);

  if (!metrics) return null;

  const totalRows = endOfDay?.appointments.length ?? 0;
  const overallConf = validationReport?.overallConfidence ?? 'high';
  const confLabel = overallConf === 'high' ? 'high' : overallConf === 'review' ? 'medium' : 'low';
  const confVariance = validationReport?.fields.reduce((max, f) => Math.max(max, f.pctDifference), 0) ?? 0;

  const schedReliability = metrics.totalScheduled > 0 ? metrics.totalCompleted / metrics.totalScheduled : 0;
  const disruptionRate = metrics.totalScheduled > 0
    ? (metrics.totalCanceled + metrics.totalNoShow + metrics.rescheduledCount) / metrics.totalScheduled
    : 0;

  // Find biggest funnel drop-off
  const biggestDrop = patientFunnel?.stages.reduce((worst, s, i) => {
    if (i === 0 || s.conversionRate === null) return worst;
    if (!worst || (s.conversionRate < (worst.conversionRate ?? 1))) return s;
    return worst;
  }, null as typeof patientFunnel.stages[0] | null);

  // Charts
  const allWeeks = new Set<string>();
  metrics.weeklyKept.forEach(d => allWeeks.add(d.week));
  metrics.weeklyCanceled.forEach(d => allWeeks.add(d.week));

  const keptMap = new Map(metrics.weeklyKept.map(d => [d.week, d.value]));
  const cancelMap = new Map(metrics.weeklyCanceled.map(d => [d.week, d.value]));

  const weeklyComboChart = Array.from(allWeeks).sort().map(week => ({
    week, kept: keptMap.get(week) ?? 0, canceled: cancelMap.get(week) ?? 0,
  }));

  const weeklyROFChart = metrics.weeklyROFRate.map(d => ({ week: d.week, rofCompletionRate: d.value * 100 }));

  const doNow = insights.filter(i => i.severity === 'high');
  const reviewWeek = insights.filter(i => i.severity === 'medium');

  return (
    <div className="space-y-8">
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

      {/* ROW 1: Clinic Health Score */}
      {clinicHealthScore && (
        <Card className={`${STATUS_BG[clinicHealthScore.status]}`}>
          <CardContent className="py-5 px-6">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clinic Health Score</div>
                <div className="flex items-center gap-3">
                  <span className={`text-5xl font-bold ${STATUS_COLORS[clinicHealthScore.status]}`}>
                    {clinicHealthScore.score}
                  </span>
                  <Badge variant="outline" className={`text-xs ${STATUS_BG[clinicHealthScore.status]}`}>
                    {clinicHealthScore.statusLabel}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">— (first quarter loaded)</div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Popover open={healthBreakdownOpen} onOpenChange={setHealthBreakdownOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                      <HelpCircle className="h-3.5 w-3.5" />
                      View score breakdown
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] text-xs space-y-2" side="bottom">
                    <h4 className="font-semibold text-sm">Health Score Components</h4>
                    <p className="text-muted-foreground">Composite of 5 operational metrics. Each normalized against chiropractic benchmarks.</p>
                    <div className="space-y-1.5">
                      {clinicHealthScore.components.map(c => (
                        <div key={c.label} className="flex items-center justify-between p-1.5 rounded bg-muted/50">
                          <span>{c.label}</span>
                          <span className="font-mono">
                            {(c.rawValue * 100).toFixed(0)}% → {c.weightedContribution.toFixed(0)}/{(c.weight * 100).toFixed(0)} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROW 2: Three-question summary strip */}
      <div className="grid gap-3 md:grid-cols-3">
        <QuestionCard
          question="Are we keeping patients?"
          metric={`${(schedReliability * 100).toFixed(1)}%`}
          label="Schedule Reliability"
          benchmark={getBenchmarkStatus(schedReliability, BENCHMARKS.scheduleReliability)}
          detail={`${metrics.totalCompleted} / ${metrics.totalScheduled} visits completed`}
        />
        <QuestionCard
          question="Are we losing visits?"
          metric={`${(disruptionRate * 100).toFixed(1)}%`}
          label="Disruption Rate"
          benchmark={getBenchmarkStatus(1 - disruptionRate, BENCHMARKS.disruptionResistance)}
          detail={`${metrics.totalCanceled + metrics.totalNoShow + metrics.rescheduledCount} disruption events`}
        />
        <div
          className="p-4 rounded-lg border bg-card cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => navigate('/patient-flow')}
        >
          <div className="text-[10px] text-muted-foreground mb-1">Where are patients dropping off?</div>
          <div className="text-lg font-bold">
            {biggestDrop ? `${biggestDrop.label}` : '—'}
          </div>
          {biggestDrop && biggestDrop.dropOff > 0 && (
            <div className="text-xs text-destructive/70">{biggestDrop.dropOff} patients lost</div>
          )}
          <div className="text-[10px] text-primary flex items-center gap-1 mt-1">
            View funnel <ArrowRight className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>

      {/* ROW 3: Patient Funnel (compact) */}
      {patientFunnel && patientFunnel.npPatientCount > 0 && (
        <Card className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate('/patient-flow')}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Patient Funnel (unique patients)
              <ArrowRight className="h-2.5 w-2.5" />
            </div>
            <div className="flex items-center gap-1 flex-wrap text-sm">
              {patientFunnel.stages.map((s, i) => (
                <span key={s.label} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
                  <span className="font-bold">{s.count}</span>
                  <span className="text-muted-foreground text-xs">{s.label}</span>
                  {s.conversionRate !== null && (
                    <span className="text-[10px] text-muted-foreground">({(s.conversionRate * 100).toFixed(0)}%)</span>
                  )}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROW 4: Key Findings */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {insights.slice(0, showAllInsights ? undefined : 5).map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${severityDot[insight.severity]}`} />
                  <div>
                    <span>{insight.text}</span>
                    <span className="text-muted-foreground ml-1 text-xs">— {insight.action}</span>
                  </div>
                </div>
              ))}
              {insights.length > 5 && (
                <button
                  className="text-xs text-primary hover:underline mt-1"
                  onClick={() => setShowAllInsights(!showAllInsights)}
                >
                  {showAllInsights ? 'Show less' : `Show all ${insights.length} findings`}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROW 5: Risk + Revenue side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Patients at Risk */}
        {patientRisk && (patientRisk.highRiskCount > 0 || patientRisk.mediumRiskCount > 0) && (
          <Card className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate('/patients-at-risk')}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold">Patients at Risk</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-2xl font-bold text-destructive">{patientRisk.highRiskCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">High Risk</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-warning">{patientRisk.mediumRiskCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">Medium Risk</span>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Patients showing disruption patterns that predict drop-out
              </div>
              <div className="text-[10px] text-primary flex items-center gap-1 mt-2">
                Review patients <ArrowRight className="h-2.5 w-2.5" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue Leakage */}
        {revenueMetrics && revenueMetrics.estimatedCancellationLeakage > 0 && (
          <Card>
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Revenue Intelligence</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] text-muted-foreground">Estimated Cancellation Leakage</div>
                  <div className="text-xl font-bold text-destructive/80">{fmt$(revenueMetrics.estimatedCancellationLeakage)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {revenueMetrics.canceledCount} canceled × {fmt$(revenueMetrics.avgChargePerCompleted)} avg charge
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Avg Revenue/NP</div>
                    <div className="text-sm font-bold">{fmt$(revenueMetrics.avgRevenuePerNP)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">NP Cohort Revenue</div>
                    <div className="text-sm font-bold">{fmt$(revenueMetrics.npCohortRevenue)}</div>
                  </div>
                </div>
                {revenueMetrics.additionalRofPatients > 0 && (
                  <div className="text-[10px] text-muted-foreground p-2 rounded bg-success/5 border border-success/20">
                    <TrendingUp className="h-3 w-3 inline mr-1 text-success" />
                    If NP→ROF improved to 75%: +~{fmt$(revenueMetrics.estimatedAdditionalRevenue)} estimated
                  </div>
                )}
              </div>
              <div className="text-[9px] text-muted-foreground mt-2 italic">
                Based on posted charges. Actual collections may differ.
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ROW 6: Game Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight">Operational Game Plan</CardTitle>
          <CardDescription className="text-xs">Prioritized actions derived from this period's data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ActionBucket title="Do Now" severity="high" items={[
              ...doNow.map(i => i.text),
              ...(patientRisk && patientRisk.highRiskCount > 10 ? [`Review ${patientRisk.highRiskCount} high-risk patients.`] : []),
              'Review Patients Needing Review list.',
            ]} />
            <ActionBucket title="Review This Week" severity="medium" items={[
              ...reviewWeek.map(i => i.text),
              'Audit ROF → active treatment progression.',
              ...(patientRisk && patientRisk.riskDrivers.repeatReschedules > 5
                ? [`Review ${patientRisk.riskDrivers.repeatReschedules} patients with 2+ reschedules.`]
                : []),
            ]} />
            <ActionBucket title="Process Improvements" severity="low" items={[
              ...(patientFunnel && patientFunnel.npPatientCount > 0 &&
                patientFunnel.rofPatientCount / patientFunnel.npPatientCount < 0.70
                ? ['Consider scheduling ROF at point of NP visit.']
                : []),
              'Standardize visit-type labels in ChiroTouch.',
              ...(metrics.totalCanceled / metrics.totalScheduled > 0.14
                ? ['Review front desk reschedule recovery protocol.']
                : []),
            ]} />
            <ActionBucket title="Monitor Next Quarter" severity="neutral" items={[
              'NP → ROF conversion trend',
              'Care continuation rate (3+ treatment visits)',
              'Disruption-heavy patient count',
            ]} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 italic">
            This game plan reflects operational patterns in the uploaded reports.
            All items are scheduling and workflow observations — not clinical directives.
          </p>
        </CardContent>
      </Card>

      {/* ROW 7: Summary Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {weeklyComboChart.length > 0 && (
          <Card className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate('/analysis')}>
            <CardHeader className="pb-2">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Evidence</div>
              <CardTitle className="text-xs font-medium">Weekly Completed Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weeklyComboChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-[10px]" />
                  <YAxis className="text-[10px]" />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={goals.weeklyKept} stroke="hsl(var(--success))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="kept" stroke="hsl(var(--primary))" strokeWidth={2} name="Completed" dot={false} />
                  <Line type="monotone" dataKey="canceled" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="4 4" name="Canceled" dot={false} opacity={0.4} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {weeklyROFChart.length > 0 && (
          <Card className="cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => navigate('/analysis')}>
            <CardHeader className="pb-2">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Evidence</div>
              <CardTitle className="text-xs font-medium">ROF Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
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

      {/* Footer */}
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
    </div>
  );
}

function QuestionCard({ question, metric, label, benchmark, detail }: {
  question: string; metric: string; label: string;
  benchmark: 'excellent' | 'healthy' | 'watch' | 'risk';
  detail: string;
}) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="text-[10px] text-muted-foreground mb-1">{question}</div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">{metric}</span>
        <Badge variant="outline" className={`text-[9px] ${STATUS_BG[benchmark]}`}>
          {STATUS_LABELS[benchmark]}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{detail}</div>
    </div>
  );
}

function ActionBucket({ title, severity, items }: { title: string; severity: 'high' | 'medium' | 'low' | 'neutral'; items: string[] }) {
  const color = severity === 'high' ? 'border-l-destructive'
    : severity === 'medium' ? 'border-l-warning'
    : severity === 'low' ? 'border-l-primary'
    : 'border-l-muted-foreground';
  return (
    <div className={`border-l-2 ${color} pl-3 space-y-1.5`}>
      <h4 className="text-xs font-semibold">{title}</h4>
      <ul className="space-y-1">
        {items.filter(Boolean).slice(0, 5).map((item, i) => (
          <li key={i} className="text-[11px] text-muted-foreground leading-tight">{item}</li>
        ))}
      </ul>
    </div>
  );
}
