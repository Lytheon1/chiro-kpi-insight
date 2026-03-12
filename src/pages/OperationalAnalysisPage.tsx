import { useState } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import { ProviderComparisonTable } from '@/components/dashboard/ProviderComparisonTable';
import { CarePathSection } from '@/components/dashboard/CarePathSection';
import { RescheduleInsights } from '@/components/dashboard/RescheduleInsights';
import { ReasonBreakdown } from '@/components/dashboard/ReasonBreakdown';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { containsAny, normalizeText } from '@/lib/utils/normalize';
import { getProviderColor, isSingleProviderMode } from '@/lib/utils/providerColors';
import type { EndOfDayAppointmentRow, CmrRow } from '@/types/reports';

const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s;

const CustomTick = ({ x, y, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <title>{payload.value}</title>
    <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={10}>
      {truncate(payload.value, 30)}
    </text>
  </g>
);

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '11px',
};

const FUNNEL_COLORS = [
  'hsl(220, 40%, 22%)',
  'hsl(220, 35%, 35%)',
  'hsl(220, 30%, 48%)',
  'hsl(220, 25%, 60%)',
  'hsl(220, 20%, 72%)',
];

// ─── Custom NP Next Step Tooltip ────────────────────────────────────────────
function NPNextStepTooltip({ active, payload, totalNP }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div style={tooltipStyle} className="p-2.5 shadow-md">
      <div className="font-medium text-xs mb-1">{data.category}</div>
      <div className="text-[11px]">{data.count} patients</div>
      <div className="text-[11px] text-muted-foreground">
        {(data.pctOfCohort * 100).toFixed(1)}% of NP cohort
      </div>
      {data.note && (
        <div className="text-[10px] text-muted-foreground mt-1 italic">{data.note}</div>
      )}
    </div>
  );
}

export default function OperationalAnalysisPage() {
  const { metrics, carePathAnalysis, sequenceAnalysis, activeFilters, endOfDay, cmr, goals, validationReport, allProviders } = useDashboard();
  const [drilldownWeek, setDrilldownWeek] = useState<string | null>(null);

  const singleProvider = isSingleProviderMode(allProviders);

  if (!metrics || !carePathAnalysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No data available. Upload reports first.
        </CardContent>
      </Card>
    );
  }

  // Funnel data
  const funnelData = [
    { name: 'New Patient', value: metrics.newPatients, fill: FUNNEL_COLORS[0] },
    { name: 'ROF', value: metrics.completedROF, fill: FUNNEL_COLORS[1] },
    { name: 'Active Treatment', value: carePathAnalysis.providerMetrics.reduce((s, p) => s + Math.round(p.rofToActiveTreatmentRate * p.rofCount), 0), fill: FUNNEL_COLORS[2] },
    { name: 'Re-Exam / Final', value: carePathAnalysis.providerMetrics.reduce((s, p) => s + (p.classificationCounts.progressed_as_expected || 0), 0), fill: FUNNEL_COLORS[3] },
    { name: 'Maintenance', value: carePathAnalysis.maintenanceOnlyCount, fill: FUNNEL_COLORS[4] },
  ].filter(d => d.value > 0);

  // Weekly charts
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
    week, kept: keptMap.get(week) ?? 0, canceled: cancelMap.get(week) ?? 0,
    noShow: noShowMap.get(week) ?? 0, rescheduled: reschMap.get(week) ?? 0,
  }));

  const weeklyROFChart = metrics.weeklyROFRate.map(d => ({ week: d.week, rofRate: d.value * 100 }));
  const weeklyRetChart = metrics.weeklyRetentionRate.map(d => ({ week: d.week, retRate: d.value * 100 }));

  const drilldownRows = drilldownWeek ? (metrics.weeklyRows.get(drilldownWeek) || []) : [];
  const drilldownCmrRows = drilldownWeek ? (metrics.weeklyCmrRows.get(drilldownWeek) || []) : [];

  const handleChartClick = (week: string) => {
    setDrilldownWeek(drilldownWeek === week ? null : week);
  };

  // Provider colors for bar charts
  const reschByProviderWithColor = metrics.rescheduledByProvider.map(d => ({
    ...d,
    fill: getProviderColor(d.provider),
  }));

  return (
    <div className="space-y-6">
      {/* Pipeline Funnel */}
      {funnelData.length > 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Patient Pipeline
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Shows patient flow from New Patient through care stages. Numbers represent counts for the reporting period.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <FunnelChart>
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="center" fill="white" fontSize={11} formatter={(v: number) => v} />
                  <LabelList position="right" fill="hsl(var(--muted-foreground))" fontSize={10} dataKey="name" />
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Provider Comparison — only show table when multiple providers */}
      {!singleProvider && (
        <ProviderComparisonTable
          carePathMetrics={carePathAnalysis.providerMetrics}
          disruptions={metrics.providerDisruptions}
          metrics={metrics}
        />
      )}

      {/* Care Path */}
      <CarePathSection analysis={carePathAnalysis} />

      {/* NP Next Step */}
      {sequenceAnalysis && sequenceAnalysis.npNextSteps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              What happens after a New Patient visit?
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Shows the next <strong>meaningful</strong> visit step after a New Patient visit.
                  Duplicate or disrupted scheduling rows are handled separately.
                  ROF is the expected next step.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription className="text-xs">
              {sequenceAnalysis.totalNPPatients} NP patients tracked.
              {sequenceAnalysis.unexpectedNextStepCount > 0 && (
                <span className="text-warning ml-1">
                  {sequenceAnalysis.unexpectedNextStepCount} ({(sequenceAnalysis.unexpectedNextStepPct * 100).toFixed(0)}%) unexpected next step.
                </span>
              )}
              {sequenceAnalysis.duplicateNPCount > 0 && (
                <span className="text-muted-foreground ml-1">
                  {sequenceAnalysis.duplicateNPCount} duplicate/rebooked NP rows excluded.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ResponsiveContainer width="100%" height={Math.max(160, sequenceAnalysis.npNextSteps.length * 32)}>
              <BarChart data={sequenceAnalysis.npNextSteps} layout="vertical" margin={{ left: 200, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" className="text-[10px]" />
                <YAxis type="category" dataKey="category" width={190} tick={<CustomTick />} />
                <RechartsTooltip content={<NPNextStepTooltip totalNP={sequenceAnalysis.totalNPPatients} />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>

            {/* Companion data table */}
            <div className="rounded border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Next Step</TableHead>
                    <TableHead className="text-[10px] text-right">Count</TableHead>
                    <TableHead className="text-[10px] text-right">% of NP Cohort</TableHead>
                    <TableHead className="text-[10px]">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sequenceAnalysis.npNextSteps.map(s => (
                    <TableRow key={s.category}>
                      <TableCell className="text-[10px] font-medium">{s.category}</TableCell>
                      <TableCell className="text-[10px] text-right">{s.count}</TableCell>
                      <TableCell className="text-[10px] text-right">{(s.pctOfCohort * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{s.note || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-[10px] text-muted-foreground p-2.5 rounded bg-muted/50 border">
              This chart reflects the next meaningful visit step after a New Patient visit.
              Duplicate or disrupted scheduling rows are handled separately.
              "Disruption Before ROF" patients still reached ROF but had canceled/rescheduled events first.
            </div>

            <InsightBlock
              observation={`${sequenceAnalysis.unexpectedNextStepCount} of ${sequenceAnalysis.totalNPPatients} NP patients had an unexpected next step.`}
              interpretation="Patients whose next meaningful visit after NP is not ROF may indicate scheduling gaps or visit-type labeling issues."
              causes={['ROF not scheduled at NP visit', 'Visit-type label mismatch in ChiroTouch', 'Patient returned for different reason']}
              action="Review NP scheduling workflow to ensure ROF is confirmed before patient leaves."
            />
          </CardContent>
        </Card>
      )}

      {/* ROF Next 2 */}
      {sequenceAnalysis && sequenceAnalysis.rofPaths.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Treatment start pattern after ROF
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Shows the next 2 completed visits after ROF. Canceled/no-show visits are skipped.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription className="text-xs">{sequenceAnalysis.totalROFPatients} ROF patients tracked.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ResponsiveContainer width="100%" height={Math.max(160, sequenceAnalysis.rofPaths.length * 28)}>
              <BarChart data={sequenceAnalysis.rofPaths} layout="vertical" margin={{ left: 200, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" className="text-[10px]" />
                <YAxis type="category" dataKey="path" width={190} tick={<CustomTick />} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 3, 3, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-[10px] text-muted-foreground p-2.5 rounded bg-muted/50 border">
              Patients who moved from ROF into a maintenance-style visit without visible active treatment
              may reflect a complete prior plan or an early maintenance transition — review manually.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Charts */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Trends & Drilldowns</h3>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">Weekly Kept Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyComboChart} onClick={e => { if (e?.activeLabel) handleChartClick(e.activeLabel); }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-[10px]" />
                <YAxis className="text-[10px]" />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="kept" fill="hsl(var(--primary))" name="Kept" radius={[3, 3, 0, 0]} cursor="pointer" />
                <Bar dataKey="canceled" fill="hsl(var(--destructive))" name="Canceled" radius={[3, 3, 0, 0]} opacity={0.3} />
                <Bar dataKey="noShow" fill="hsl(var(--warning))" name="No-Show" radius={[3, 3, 0, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {drilldownWeek && (
          <InlineDrilldown week={drilldownWeek} rows={drilldownRows} cmrRows={drilldownCmrRows} filters={activeFilters} />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">ROF Completion Rate by Week</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyROFChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-[10px]" />
                  <YAxis className="text-[10px]" domain={[0, 100]} />
                  <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
                  <Bar dataKey="rofRate" fill="hsl(var(--secondary))" name="ROF %" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Retention Rate by Week</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyRetChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-[10px]" />
                  <YAxis className="text-[10px]" domain={[0, 100]} />
                  <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
                  <Bar dataKey="retRate" fill="hsl(var(--primary))" name="Retention %" radius={[3, 3, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reason Breakdowns */}
      <ReasonBreakdown
        topCancelReasons={metrics.topCancelReasons}
        topRescheduleReasons={metrics.topRescheduleReasons}
      />

      {/* Disruption */}
      <RescheduleInsights metrics={metrics} singleProvider={singleProvider} />
    </div>
  );
}

function InsightBlock({ observation, interpretation, causes, action }: {
  observation: string; interpretation: string; causes: string[]; action: string;
}) {
  return (
    <div className="text-xs space-y-1.5 p-3 rounded border bg-muted/30">
      <div><span className="font-medium">Observation:</span> {observation}</div>
      <div><span className="font-medium">Interpretation:</span> {interpretation}</div>
      <div>
        <span className="font-medium">Possible causes:</span>
        <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-muted-foreground">
          {causes.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
      <div><span className="font-medium">Suggested review:</span> {action}</div>
    </div>
  );
}

function InlineDrilldown({ week, rows, cmrRows, filters }: {
  week: string; rows: EndOfDayAppointmentRow[]; cmrRows: CmrRow[]; filters: any;
}) {
  const kept = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.completedKeywords)).length;
  const canceled = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.canceledKeywords)).length;
  const noShow = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.noShowKeywords)).length;
  const rescheduled = cmrRows.filter(r => containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)).length;
  const scheduledDenom = kept + canceled + noShow;
  const retRate = scheduledDenom > 0 ? (kept / scheduledDenom * 100).toFixed(1) : '0';

  const provMap = new Map<string, { kept: number; canceled: number; noShow: number; rescheduled: number }>();
  for (const r of rows) {
    const p = r.provider || 'Unknown';
    if (!provMap.has(p)) provMap.set(p, { kept: 0, canceled: 0, noShow: 0, rescheduled: 0 });
    const s = normalizeText(r.statusRaw);
    if (containsAny(s, filters.completedKeywords)) provMap.get(p)!.kept++;
    if (containsAny(s, filters.canceledKeywords)) provMap.get(p)!.canceled++;
    if (containsAny(s, filters.noShowKeywords)) provMap.get(p)!.noShow++;
  }
  for (const r of cmrRows) {
    const p = r.provider || 'Unknown';
    if (!provMap.has(p)) provMap.set(p, { kept: 0, canceled: 0, noShow: 0, rescheduled: 0 });
    if (containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)) provMap.get(p)!.rescheduled++;
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium">Drilldown: {week}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { label: 'Kept', value: kept, color: 'text-success' },
            { label: 'Canceled', value: canceled, color: 'text-destructive' },
            { label: 'No-Show', value: noShow, color: 'text-warning' },
            { label: 'Rescheduled', value: rescheduled },
            { label: 'Retention', value: `${retRate}%` },
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded border bg-card">
              <div className={`text-lg font-bold ${s.color || ''}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="rounded border overflow-auto max-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Provider</TableHead>
                <TableHead className="text-[10px] text-right">Kept</TableHead>
                <TableHead className="text-[10px] text-right">Cancel</TableHead>
                <TableHead className="text-[10px] text-right">No-Show</TableHead>
                <TableHead className="text-[10px] text-right">Resch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(provMap.entries()).map(([prov, d]) => (
                <TableRow key={prov}>
                  <TableCell className="text-[10px] font-medium">{prov}</TableCell>
                  <TableCell className="text-[10px] text-right">{d.kept}</TableCell>
                  <TableCell className="text-[10px] text-right">{d.canceled}</TableCell>
                  <TableCell className="text-[10px] text-right">{d.noShow}</TableCell>
                  <TableCell className="text-[10px] text-right">{d.rescheduled}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
