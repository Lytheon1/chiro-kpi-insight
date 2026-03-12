import { useState } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { containsAny, normalizeText } from '@/lib/utils/normalize';
import { ReasonBreakdown } from '@/components/dashboard/ReasonBreakdown';
import { RescheduleInsights } from '@/components/dashboard/RescheduleInsights';
import type { EndOfDayAppointmentRow, CmrRow } from '@/types/reports';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export default function TrendsPage() {
  const { metrics, goals, endOfDay, cmr, activeFilters } = useDashboard();
  const [drilldownWeek, setDrilldownWeek] = useState<string | null>(null);

  if (!metrics) return null;

  // Build chart data
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

  const weeklyROFChart = metrics.weeklyROFRate.map(d => ({ week: d.week, rofRate: d.value * 100 }));
  const weeklyRetChart = metrics.weeklyRetentionRate.map(d => ({ week: d.week, retRate: d.value * 100 }));
  const weeklyReschChart = metrics.weeklyRescheduled.map(d => ({ week: d.week, rescheduled: d.value }));

  // Drilldown data
  const drilldownRows = drilldownWeek ? (metrics.weeklyRows.get(drilldownWeek) || []) : [];
  const drilldownCmrRows = drilldownWeek ? (metrics.weeklyCmrRows.get(drilldownWeek) || []) : [];

  const handleClick = (week: string) => {
    setDrilldownWeek(drilldownWeek === week ? null : week);
  };

  return (
    <div className="space-y-6">
      {/* Weekly Kept */}
      <ChartWithDrilldown
        title="Weekly Kept Appointments"
        description="Completed non-massage appointments per week with comparison lines."
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={weeklyComboChart} onClick={e => { if (e?.activeLabel) handleClick(e.activeLabel); }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="week" className="text-xs" />
            <YAxis className="text-xs" />
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Legend />
            <ReferenceLine y={goals.weeklyKept} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
            <Line type="monotone" dataKey="kept" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Kept" dot={{ fill: 'hsl(var(--primary))', cursor: 'pointer' }} />
            <Line type="monotone" dataKey="canceled" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="5 5" name="Canceled" dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="noShow" stroke="hsl(var(--warning))" strokeWidth={1} strokeDasharray="5 5" name="No-Show" dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="rescheduled" stroke="hsl(var(--accent))" strokeWidth={1} strokeDasharray="5 5" name="Rescheduled" dot={false} opacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      </ChartWithDrilldown>

      {drilldownWeek && <InlineDrilldown week={drilldownWeek} rows={drilldownRows} cmrRows={drilldownCmrRows} filters={activeFilters} />}

      <div className="grid gap-6 md:grid-cols-2">
        {/* ROF Rate */}
        <ChartWithDrilldown title="ROF Completion Rate by Week">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyROFChart} onClick={e => { if (e?.activeLabel) handleClick(e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" className="text-xs" />
              <YAxis className="text-xs" domain={[0, 100]} />
              <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
              <ReferenceLine y={goals.rofRate} stroke="hsl(var(--success))" strokeDasharray="3 3" />
              <Bar dataKey="rofRate" fill="hsl(var(--secondary))" name="ROF %" radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartWithDrilldown>

        {/* Retention Rate */}
        <ChartWithDrilldown title="Retention Rate by Week">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyRetChart} onClick={e => { if (e?.activeLabel) handleClick(e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" className="text-xs" />
              <YAxis className="text-xs" domain={[0, 100]} />
              <RechartsTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
              <ReferenceLine y={goals.retentionRate} stroke="hsl(var(--success))" strokeDasharray="3 3" />
              <Bar dataKey="retRate" fill="hsl(var(--accent))" name="Retention %" radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartWithDrilldown>
      </div>

      {/* Weekly Rescheduled */}
      <ChartWithDrilldown title="Weekly Rescheduled Count" description="From Report B.">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={weeklyReschChart} onClick={e => { if (e?.activeLabel) handleClick(e.activeLabel); }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="week" className="text-xs" />
            <YAxis className="text-xs" />
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Bar dataKey="rescheduled" fill="hsl(var(--primary))" name="Rescheduled" radius={[4, 4, 0, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWithDrilldown>

      {/* Reason Breakdowns */}
      <ReasonBreakdown
        topCancelReasons={metrics.topCancelReasons}
        topRescheduleReasons={metrics.topRescheduleReasons}
      />

      {/* Reschedule Insights */}
      <RescheduleInsights metrics={metrics} />
    </div>
  );
}

function ChartWithDrilldown({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InlineDrilldown({ week, rows, cmrRows, filters }: {
  week: string;
  rows: EndOfDayAppointmentRow[];
  cmrRows: CmrRow[];
  filters: any;
}) {
  const kept = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.completedKeywords)).length;
  const canceled = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.canceledKeywords)).length;
  const noShow = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.noShowKeywords)).length;
  const rescheduled = cmrRows.filter(r => containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)).length;
  const scheduledDenom = kept + canceled + noShow;
  const retRate = scheduledDenom > 0 ? (kept / scheduledDenom * 100).toFixed(1) : '0';

  const rofScheduled = rows.filter(r =>
    containsAny(normalizeText(r.purposeRaw), filters.rofKeywords) &&
    (containsAny(normalizeText(r.statusRaw), filters.completedKeywords) ||
     containsAny(normalizeText(r.statusRaw), filters.canceledKeywords) ||
     containsAny(normalizeText(r.statusRaw), filters.noShowKeywords))
  ).length;
  const rofCompleted = rows.filter(r =>
    containsAny(normalizeText(r.purposeRaw), filters.rofKeywords) &&
    containsAny(normalizeText(r.statusRaw), filters.completedKeywords)
  ).length;

  // Provider breakdown
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

  // Top reasons
  const cancelReasons = new Map<string, number>();
  const reschReasons = new Map<string, number>();
  for (const r of cmrRows) {
    const s = normalizeText(r.statusRaw);
    const reason = r.reasonRaw?.trim() || 'Unspecified';
    if (containsAny(s, filters.canceledKeywords)) cancelReasons.set(reason, (cancelReasons.get(reason) ?? 0) + 1);
    if (containsAny(s, filters.rescheduledKeywords)) reschReasons.set(reason, (reschReasons.get(reason) ?? 0) + 1);
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-sm">Drilldown: {week}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Kept', value: kept, color: 'text-success' },
            { label: 'Canceled', value: canceled, color: 'text-destructive' },
            { label: 'No-Show', value: noShow, color: 'text-warning' },
            { label: 'Rescheduled', value: rescheduled, color: 'text-primary' },
            { label: 'ROF Sched', value: rofScheduled },
            { label: 'ROF Kept', value: rofCompleted },
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-md bg-background border">
              <div className={`text-xl font-bold ${s.color || ''}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">Retention: <span className="font-medium text-foreground">{retRate}%</span></div>

        <div className="rounded border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Kept</TableHead>
                <TableHead className="text-right">Canceled</TableHead>
                <TableHead className="text-right">No-Show</TableHead>
                <TableHead className="text-right">Rescheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(provMap.entries()).map(([prov, d]) => (
                <TableRow key={prov}>
                  <TableCell className="text-xs font-medium">{prov}</TableCell>
                  <TableCell className="text-xs text-right">{d.kept}</TableCell>
                  <TableCell className="text-xs text-right">{d.canceled}</TableCell>
                  <TableCell className="text-xs text-right">{d.noShow}</TableCell>
                  <TableCell className="text-xs text-right">{d.rescheduled}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Top reasons */}
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          {cancelReasons.size > 0 && (
            <div>
              <h4 className="font-medium mb-1">Top Cancel Reasons</h4>
              {Array.from(cancelReasons.entries()).sort(([,a],[,b]) => b - a).slice(0, 5).map(([r, c]) => (
                <div key={r} className="flex justify-between">
                  <span className="truncate max-w-[200px]">{r}</span>
                  <Badge variant="outline" className="text-[10px] ml-2">{c}</Badge>
                </div>
              ))}
            </div>
          )}
          {reschReasons.size > 0 && (
            <div>
              <h4 className="font-medium mb-1">Top Reschedule Reasons</h4>
              {Array.from(reschReasons.entries()).sort(([,a],[,b]) => b - a).slice(0, 5).map(([r, c]) => (
                <div key={r} className="flex justify-between">
                  <span className="truncate max-w-[200px]">{r}</span>
                  <Badge variant="outline" className="text-[10px] ml-2">{c}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patient list */}
        <div className="rounded border overflow-auto max-h-[250px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Visit Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.date}</TableCell>
                  <TableCell className="text-xs">{r.patientName || '—'}</TableCell>
                  <TableCell className="text-xs">{r.provider}</TableCell>
                  <TableCell className="text-xs">{r.purposeRaw}</TableCell>
                  <TableCell className="text-xs">{r.statusRaw}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
