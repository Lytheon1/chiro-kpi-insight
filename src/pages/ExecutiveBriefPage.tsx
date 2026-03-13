/**
 * Executive Brief — "Doctor View" page.
 * Restyled to match consulting-grade reference design.
 * Dark navy health score, horizontal funnel bars, collapsible insights, colored game plan.
 */
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Line, LineChart,
} from 'recharts';
import { useDashboard } from '@/lib/context/DashboardContext';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { STATUS_COLORS, STATUS_BG, STATUS_LABELS, BENCHMARKS, getBenchmarkStatus } from '@/lib/kpi/benchmarks';
import type { InsightSeverity } from '@/lib/kpi/generateInsights';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
};

const fmt$ = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function getStatusColor(status: 'excellent' | 'healthy' | 'watch' | 'risk') {
  return status === 'excellent' ? 'hsl(var(--success))' :
    status === 'healthy' ? 'hsl(152 48% 42%)' :
    status === 'watch' ? 'hsl(var(--warning))' :
    'hsl(var(--destructive))';
}

export default function ExecutiveBriefPage() {
  const navigate = useNavigate();
  const {
    metrics, carePathAnalysis, insights, goals, effectiveWeeks,
    sequenceAnalysis, validationReport, evidenceStore, endOfDay, allProviders,
    patientFunnel, patientRisk, revenueMetrics, clinicHealthScore,
  } = useDashboard();
  const singleProvider = allProviders.length <= 1;
  const [showAllInsights, setShowAllInsights] = useState(false);

  if (!metrics) return null;

  const totalRows = endOfDay?.appointments.length ?? 0;
  const overallConf = validationReport?.overallConfidence ?? 'high';
  const confLabel = overallConf === 'high' ? 'high' : overallConf === 'review' ? 'medium' : 'low';
  const confVariance = validationReport?.fields.reduce((max, f) => Math.max(max, f.pctDifference), 0) ?? 0;

  // Schedule Reliability: provider-relevant visits only (excludes massage + admin)
  const schedReliability = metrics.scheduledNonMassage > 0 ? metrics.completedNonMassage / metrics.scheduledNonMassage : 0;
  const disruptionRate = metrics.scheduledNonMassage > 0
    ? (metrics.totalCanceled + metrics.totalNoShow + metrics.rescheduledCount) / metrics.scheduledNonMassage
    : 0;

  const biggestDrop = patientFunnel?.stages.reduce((worst, s, i) => {
    if (i === 0 || s.conversionRate === null) return worst;
    if (!worst || (s.conversionRate < (worst.conversionRate ?? 1))) return s;
    return worst;
  }, null as typeof patientFunnel.stages[0] | null);

  // Weekly chart data
  const allWeeks = new Set<string>();
  metrics.weeklyKept.forEach(d => allWeeks.add(d.week));
  metrics.weeklyCanceled.forEach(d => allWeeks.add(d.week));
  const keptMap = new Map(metrics.weeklyKept.map(d => [d.week, d.value]));
  const cancelMap = new Map(metrics.weeklyCanceled.map(d => [d.week, d.value]));
  const weeklyBarChart = Array.from(allWeeks).sort().map(week => ({
    week, completed: keptMap.get(week) ?? 0, canceled: cancelMap.get(week) ?? 0,
  }));

  const doNow = insights.filter(i => i.severity === 'high');
  const reviewWeek = insights.filter(i => i.severity === 'medium');

  return (
    <div className="space-y-6">
      {/* ROW 1: Health Score — dark navy card */}
      {clinicHealthScore && <HealthScoreCard score={clinicHealthScore} />}

      {/* ROW 2: Three-question KPI strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <div
          className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-secondary transition-all"
          onClick={() => navigate('/patient-flow')}
        >
          <div className="text-[11px] text-faint font-medium tracking-wide">SCHEDULE RELIABILITY</div>
          <div className="text-[11px] text-faint mb-1">Are we keeping provider visits?</div>
          <div className="font-display text-3xl text-primary mt-1">{(schedReliability * 100).toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{metrics.completedNonMassage} / {metrics.scheduledNonMassage} provider visits</div>
          <div className="text-[10px] text-faint mt-0.5">Excludes massage, therapy-only, and admin visits</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${STATUS_BG[getBenchmarkStatus(schedReliability, BENCHMARKS.scheduleReliability)]}`}>
              {STATUS_LABELS[getBenchmarkStatus(schedReliability, BENCHMARKS.scheduleReliability)]}
            </Badge>
          </div>
          <div className="mt-2 benchmark-bar-track">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, schedReliability * 100)}%`, background: getStatusColor(getBenchmarkStatus(schedReliability, BENCHMARKS.scheduleReliability)) }} />
          </div>
          <div className="text-[10px] text-secondary font-medium mt-1.5 flex items-center gap-1">View retention details <ArrowRight className="h-2.5 w-2.5" /></div>
        </div>
        <div
          className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-secondary transition-all"
          onClick={() => navigate('/patients?filter=disruption_heavy')}
        >
          <div className="text-[11px] text-faint font-medium tracking-wide">DISRUPTION RATE</div>
          <div className="text-[11px] text-faint mb-1">Are we losing visits?</div>
          <div className="font-display text-3xl text-primary mt-1">{(disruptionRate * 100).toFixed(1)}%</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{metrics.totalCanceled + metrics.totalNoShow + metrics.rescheduledCount} disruption events</div>
          <div className="text-[10px] text-faint mt-0.5">{metrics.totalCanceled} canceled · {metrics.rescheduledCount} rescheduled · {metrics.totalNoShow} no-shows</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${STATUS_BG[getBenchmarkStatus(1 - disruptionRate, BENCHMARKS.disruptionResistance)]}`}>
              {STATUS_LABELS[getBenchmarkStatus(1 - disruptionRate, BENCHMARKS.disruptionResistance)]}
            </Badge>
          </div>
          <div className="text-[10px] text-secondary font-medium mt-1.5 flex items-center gap-1">View disruption details <ArrowRight className="h-2.5 w-2.5" /></div>
        </div>
        <div
          className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-secondary transition-all"
          onClick={() => navigate('/patient-flow')}
        >
          <div className="text-[11px] text-faint font-medium tracking-wide mb-1">Where are patients dropping off?</div>
          <div className="font-display text-2xl text-primary">
            {biggestDrop ? biggestDrop.label : '—'}
          </div>
          {biggestDrop && biggestDrop.dropOff > 0 && (
            <div className="text-xs text-destructive mt-0.5">{biggestDrop.dropOff} patients lost</div>
          )}
          <div className="text-[10px] text-secondary flex items-center gap-1 mt-2 font-medium">
            View funnel <ArrowRight className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>

      {/* ROW 3: Patient Funnel — horizontal bars */}
      {patientFunnel && patientFunnel.npPatientCount > 0 && (
        <Card className="cursor-pointer hover:shadow-md hover:border-secondary transition-all" onClick={() => navigate('/patient-flow')}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-semibold text-primary">Patient Care Funnel</CardTitle>
              <span className="evidence-label">EVIDENCE</span>
            </div>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={patientFunnel.stages} />
            <div className="text-[10px] text-faint mt-3 italic">
              Unique patients per care stage. Click for full funnel details.
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROW 4: Key Findings — collapsible insight blocks */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-bold tracking-widest uppercase text-faint">Key Findings</div>
          {insights.slice(0, showAllInsights ? undefined : 4).map((insight, i) => (
            <InsightBlock key={i} insight={insight} defaultOpen={i === 0 && insight.severity === 'high'} />
          ))}
          {insights.length > 4 && (
            <button
              className="text-xs text-secondary font-medium hover:underline"
              onClick={() => setShowAllInsights(!showAllInsights)}
            >
              {showAllInsights ? 'Show fewer' : `Show all ${insights.length} findings`}
            </button>
          )}
        </div>
      )}

      {/* ROW 5: Risk + Revenue side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {patientRisk && (patientRisk.highRiskCount > 0 || patientRisk.mediumRiskCount > 0) && (
          <Card className="cursor-pointer hover:shadow-md hover:border-secondary transition-all" onClick={() => navigate('/patients-at-risk')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-semibold text-primary">Patients at Risk</CardTitle>
                <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/10 text-destructive border-destructive/30">
                  <span className="w-1 h-1 rounded-full bg-destructive inline-block" />
                  Action Needed
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <div>
                  <div className="kpi-value text-destructive">{patientRisk.highRiskCount}</div>
                  <div className="text-[11px] text-muted-foreground">High Risk Patients</div>
                  <div className="text-[10px] text-faint mt-0.5">Contact within 48 hours</div>
                </div>
                <div>
                  <div className="kpi-value text-warning">{patientRisk.mediumRiskCount}</div>
                  <div className="text-[11px] text-muted-foreground">Medium Risk Patients</div>
                  <div className="text-[10px] text-faint mt-0.5">Confirm at next visit</div>
                </div>
              </div>
              <div className="text-[10px] text-secondary font-medium flex items-center gap-1 mt-3">
                View all risk patients <ArrowRight className="h-2.5 w-2.5" />
              </div>
            </CardContent>
          </Card>
        )}

        {revenueMetrics && revenueMetrics.canceledCount > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-semibold text-primary">Revenue Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Weekly leakage headline — reimbursement-based */}
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="font-display text-2xl text-destructive">
                  ~{fmt$(revenueMetrics.weeklyCollectedLeakage)}<span className="text-base text-muted-foreground">/week in missed appointment revenue</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {revenueMetrics.canceledCount} cancellations ÷ {revenueMetrics.effectiveWeeks} weeks × $128 avg reimbursement
                </div>
              </div>

              {/* Two-line leakage display */}
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="text-[10px] text-faint font-medium tracking-wide mb-1">CANCELLATION LEAKAGE</div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">Billed value foregone:</span> {fmt$(revenueMetrics.billedLeakage)}
                  </div>
                  <div className="text-[10px] text-faint">Posted charge proxy — what was billed but not seen</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-destructive">Est. collected value lost:</span> ~{fmt$(revenueMetrics.collectedLeakage)}
                  </div>
                  <div className="text-[10px] text-faint">Based on ~$128 avg reimbursement per visit</div>
                </div>
                <div className="text-[10px] text-faint italic mt-1">
                  Range: {fmt$(revenueMetrics.collectedLeakageLow)}–{fmt$(revenueMetrics.collectedLeakageHigh)} depending on payer mix of canceled appointments.
                </div>
              </div>

              {/* Lifetime Opportunity */}
              {revenueMetrics.lifetimeOpportunity.totalLostPatients > 0 && (
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <div className="text-[10px] text-faint font-medium tracking-wide mb-1">ANNUAL OPPORTUNITY FROM PATIENT RETENTION</div>
                  <div className="font-display text-2xl text-warning">
                    ~{fmt$(revenueMetrics.lifetimeOpportunity.estimatedAnnualLoss)}
                    <span className="text-xs text-muted-foreground font-sans ml-1">/year</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {revenueMetrics.lifetimeOpportunity.totalLostPatients} patients/quarter drop out before completing care
                  </div>
                  <div className="text-[10px] text-faint mt-0.5">
                    Range: {fmt$(revenueMetrics.lifetimeOpportunity.estimatedAnnualLossLow)} – {fmt$(revenueMetrics.lifetimeOpportunity.estimatedAnnualLossHigh)} depending on payer mix
                  </div>
                </div>
              )}

              {revenueMetrics.additionalRofPatients > 0 && (
                <div className="text-[11px] text-muted-foreground p-2.5 rounded bg-success/5 border border-success/20">
                  <TrendingUp className="h-3 w-3 inline mr-1 text-success" />
                  If NP→ROF improved to 75%: +~{fmt$(revenueMetrics.estimatedAdditionalRevenue)} estimated
                </div>
              )}
              <div className="text-[10px] text-faint italic">
                Reimbursement estimates use $128 weighted avg (RV ~$105, Therapy ~$140, NP ~$250, Decompression ~$120, LTC/SC ~$105, PI ~$150). Billed proxy uses ${revenueMetrics.avgPostedChargePerVisit}/visit.
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ROW 6: Game Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-semibold text-primary">Operational Game Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <GamePlanSection title="DO NOW" className="gameplan-now" titleColor="text-destructive" items={[
              ...doNow.map(i => i.text),
              ...(patientRisk && patientRisk.highRiskCount > 10 ? [`Review ${patientRisk.highRiskCount} high-risk patients.`] : []),
              'Review Patients Needing Review list.',
            ]} />
            <GamePlanSection title="REVIEW THIS WEEK" className="gameplan-week" titleColor="text-warning" items={[
              ...reviewWeek.map(i => i.text),
              'Audit ROF → active treatment progression.',
              ...(patientRisk && patientRisk.riskDrivers.repeatReschedules > 5
                ? [`Review ${patientRisk.riskDrivers.repeatReschedules} patients with 2+ reschedules.`]
                : []),
            ]} />
            <GamePlanSection title="PROCESS IMPROVEMENTS" className="gameplan-process" titleColor="text-secondary" items={[
              ...(patientFunnel && patientFunnel.npPatientCount > 0 &&
                patientFunnel.rofPatientCount / patientFunnel.npPatientCount < 0.70
                ? ['Consider scheduling ROF at point of NP visit.']
                : []),
              'Standardize visit-type labels in ChiroTouch.',
              ...(metrics.totalCanceled / metrics.totalScheduled > 0.14
                ? ['Review front desk reschedule recovery protocol.']
                : []),
            ]} />
            <GamePlanSection title="MONITOR NEXT QUARTER" className="gameplan-monitor" titleColor="text-success" items={[
              'NP → ROF conversion trend',
              'Care continuation rate (3+ treatment visits)',
              'Disruption-heavy patient count',
            ]} />
          </div>
          <div className="text-[11px] text-faint italic border-t mt-4 pt-3">
            This game plan reflects scheduling and operational patterns in the uploaded reports. All items are workflow observations — not clinical directives.
          </div>
        </CardContent>
      </Card>

      {/* ROW 7: Weekly chart */}
      {weeklyBarChart.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-semibold text-primary">Weekly Appointment Activity</CardTitle>
              <span className="evidence-label">EVIDENCE</span>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyBarChart} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--faint))' }} angle={-40} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--faint))' }} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="completed" name="Completed" fill="hsl(var(--secondary))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="canceled" name="Canceled" fill="hsl(347 70% 36% / 0.25)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-[11px] text-faint italic border-t pt-3 flex items-center gap-3">
        <ConfidenceBadge confidence={confLabel as any} />
        <span>
          {totalRows.toLocaleString()} visits analyzed.
          {confVariance < 3
            ? ' Totals reconciled within 2%.'
            : confVariance < 10
            ? ` Max variance ${confVariance.toFixed(1)}% — review source data.`
            : ` Significant variance detected (${confVariance.toFixed(1)}%) — see Validation page.`}
        </span>
      </div>
    </div>
  );
}

/* ─── Health Score Card ─── */
function HealthScoreCard({ score }: { score: any }) {
  const statusColor =
    score.score >= 80 ? 'hsl(var(--success))' :
    score.score >= 70 ? 'hsl(var(--warning))' :
    'hsl(var(--destructive))';

  return (
    <div className="health-score-card flex flex-wrap items-center gap-6">
      <div>
        <div className="text-[11px] font-medium opacity-60 uppercase tracking-widest mb-1">Clinic Health Score</div>
        <div className="font-display text-[64px] leading-none" style={{ color: statusColor }}>
          {score.score}
        </div>
        <div className="text-xl font-semibold mt-1" style={{ color: statusColor }}>
          {score.statusLabel}
        </div>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="text-[12px] opacity-50 mb-2.5">
          Trend: — (first period loaded)
        </div>
        <div className="flex flex-wrap gap-4">
          {score.components.map((c: any) => (
            <div key={c.label} className="text-[11px] opacity-65">
              <strong className="opacity-100 text-primary-foreground">{(c.rawValue * 100).toFixed(0)}%</strong>
              {' '}{c.label}
            </div>
          ))}
        </div>
        <div className="text-[11px] opacity-40 mt-3 leading-relaxed">
          Composite of 5 operational metrics weighted by clinical importance.
          {score.components
            .filter((c: any) => c.rawValue < 0.65)
            .map((c: any) => ` ${c.label} (${(c.rawValue * 100).toFixed(0)}%)`)
            .join(' and ')
          }
          {score.components.some((c: any) => c.rawValue < 0.65) ? ' are the primary watch areas.' : ''}
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({ label, question, value, sub, benchmark, benchmarkThresholds, rawValue, inverted, helper }: {
  label: string; question: string; value: string; sub: string;
  benchmark: 'excellent' | 'healthy' | 'watch' | 'risk';
  benchmarkThresholds: { excellent: number; healthy: number; watch: number };
  rawValue: number; inverted?: boolean; helper?: string;
}) {
  const barColor =
    benchmark === 'excellent' ? 'hsl(var(--success))' :
    benchmark === 'healthy' ? 'hsl(152 48% 42%)' :
    benchmark === 'watch' ? 'hsl(var(--warning))' :
    'hsl(var(--destructive))';

  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="text-[11px] text-faint font-medium tracking-wide">{label}</div>
      <div className="font-display text-3xl text-primary mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant="outline" className={`text-[10px] ${STATUS_BG[benchmark]}`}>
          <span className="w-1 h-1 rounded-full inline-block mr-1" style={{ background: barColor }} />
          {STATUS_LABELS[benchmark]}
        </Badge>
      </div>
      {/* Benchmark bar */}
      <div className="mt-2">
        <div className="benchmark-bar-track">
          <div className="h-full rounded-full transition-all" style={{
            width: `${Math.min(100, rawValue)}%`,
            background: barColor,
          }} />
        </div>
        <div className="flex justify-between text-[9px] text-faint mt-0.5">
          <span>{inverted ? 'Better ←' : '← Risk'}</span>
          <span>{inverted ? '→ Risk' : '→ Excellent'}</span>
        </div>
      </div>
      {helper && <div className="text-[10px] text-faint mt-1.5">{helper}</div>}
    </div>
  );
}

/* ─── Funnel Bars ─── */
const FUNNEL_BAR_COLORS = ['hsl(213, 63%, 40%)', 'hsl(190, 80%, 35%)', 'hsl(160, 60%, 35%)', 'hsl(270, 50%, 45%)', 'hsl(30, 80%, 35%)'];

function FunnelBars({ stages }: { stages: Array<{ label: string; count: number; conversionRate: number | null; dropOff: number; dropOffLabel: string }> }) {
  const max = stages[0]?.count || 1;
  return (
    <div className="space-y-1">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-accent/30 transition-colors">
          <div className="flex-1">
            <div className="text-[12px] font-medium text-primary mb-1">{s.label}</div>
            <div className="funnel-bar-track">
              <div
                className="funnel-bar-fill"
                style={{
                  width: `${(s.count / max) * 100}%`,
                  background: FUNNEL_BAR_COLORS[i] || FUNNEL_BAR_COLORS[0],
                }}
              />
            </div>
          </div>
          <div className="font-mono text-lg font-medium text-primary min-w-[30px] text-right">{s.count}</div>
          <div className="text-[11px] text-muted-foreground min-w-[48px]">
            {s.conversionRate !== null ? `${(s.conversionRate * 100).toFixed(0)}%` : ''}
          </div>
          {s.dropOff > 0 && (
            <div className="text-[11px] text-destructive flex items-center gap-1 min-w-[70px]">
              ↓ {s.dropOff} {s.label === 'Maintenance / SC' ? 'without maintenance' : 'lost'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Insight Block ─── */
function InsightBlock({ insight, defaultOpen }: { insight: { severity: InsightSeverity; text: string; action: string }; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const severityClass =
    insight.severity === 'high' ? 'insight-block-high' :
    insight.severity === 'medium' ? 'insight-block-medium' :
    'insight-block-low';
  const badgeClass =
    insight.severity === 'high' ? 'bg-destructive/10 text-destructive border-destructive/30' :
    insight.severity === 'medium' ? 'bg-warning/10 text-warning border-warning/30' :
    'bg-muted text-muted-foreground';
  const badgeLabel =
    insight.severity === 'high' ? '⚠ High Priority' :
    insight.severity === 'medium' ? '○ Review' : '· Note';

  return (
    <div className={`insight-block ${severityClass}`} onClick={() => setOpen(!open)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge variant="outline" className={`text-[10px] mb-1.5 ${badgeClass}`}>{badgeLabel}</Badge>
          <div className="text-[13px] font-semibold text-primary">{insight.text}</div>
        </div>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
          {open ? 'Hide ▲' : 'Details ▼'}
        </span>
      </div>
      {open && (
        <div className="mt-2.5">
          <div className="text-[12px] text-secondary font-medium">→ {insight.action}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Game Plan Section ─── */
function GamePlanSection({ title, className, titleColor, items }: {
  title: string; className: string; titleColor: string; items: string[];
}) {
  return (
    <div className={`p-4 rounded-lg ${className}`}>
      <h4 className={`text-[11px] font-bold tracking-widest uppercase mb-2 ${titleColor}`}>{title}</h4>
      <div className="space-y-1.5">
        {items.filter(Boolean).slice(0, 5).map((item, i) => (
          <div key={i} className="text-[12px] text-foreground pl-3.5 relative">
            <span className="absolute left-0 text-faint">→</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}