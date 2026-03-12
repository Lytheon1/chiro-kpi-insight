import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KPICards } from '@/components/dashboard/KPICards';
import { ReasonBreakdown } from '@/components/dashboard/ReasonBreakdown';
import { RescheduleInsights } from '@/components/dashboard/RescheduleInsights';
import { CarePathSection } from '@/components/dashboard/CarePathSection';
import { ProviderComparisonTable } from '@/components/dashboard/ProviderComparisonTable';
import { OperationalTable } from '@/components/dashboard/OperationalTable';
import { WeeklyDrilldownModal } from '@/components/dashboard/WeeklyDrilldownModal';
import { KeywordsConfig } from '@/components/dashboard/KeywordsConfigPanel';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, ChevronDown, Bug, Settings } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { ParsedEndOfDay, ParsedCMR, DashboardFilters, DashboardMetrics, EndOfDayAppointmentRow, CmrRow } from '@/types/reports';
import { calculateDashboardMetrics, DEFAULT_FILTERS } from '@/lib/kpi/calculateDashboardMetrics';
import { analyzeCarePathIntegrity } from '@/lib/kpi/analyzeCarePathIntegrity';
import { getWeekLabel } from '@/lib/kpi/groupByWeek';

interface Goals {
  rofRate: number;
  retentionRate: number;
  quarterlyKept: number;
  weeklyKept: number;
}

const defaultGoals: Goals = {
  rofRate: 74,
  retentionRate: 84,
  quarterlyKept: 390,
  weeklyKept: 30,
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const operationalRef = useRef<HTMLDivElement>(null);
  const [endOfDay, setEndOfDay] = useState<ParsedEndOfDay | null>(null);
  const [cmr, setCmr] = useState<ParsedCMR | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [weeksOverride, setWeeksOverride] = useState<string>('');
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [debugOpen, setDebugOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Weekly drilldown modal state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownWeek, setDrilldownWeek] = useState('');
  const [drilldownRows, setDrilldownRows] = useState<EndOfDayAppointmentRow[]>([]);
  const [drilldownCmrRows, setDrilldownCmrRows] = useState<CmrRow[]>([]);

  // Load data from session storage
  useState(() => {
    try {
      const eodStr = sessionStorage.getItem('parsedEndOfDay');
      const cmrStr = sessionStorage.getItem('parsedCMR');
      if (!eodStr || !cmrStr) {
        toast.error('No data found. Please upload files first.');
        navigate('/');
        return;
      }
      setEndOfDay(JSON.parse(eodStr));
      setCmr(JSON.parse(cmrStr));
    } catch {
      toast.error('Failed to load data. Please try uploading again.');
      navigate('/');
    }
  });

  const allProviders = useMemo(() => {
    if (!endOfDay || !cmr) return [];
    return [...new Set([...endOfDay.providers, ...cmr.providers])].sort();
  }, [endOfDay, cmr]);

  const activeFilters = useMemo((): DashboardFilters => {
    const wo = parseInt(weeksOverride);
    return {
      ...filters,
      provider: selectedProvider === 'All' ? undefined : selectedProvider,
      weeksOverride: wo > 0 ? wo : undefined,
    };
  }, [filters, selectedProvider, weeksOverride]);

  const metrics: DashboardMetrics | null = useMemo(() => {
    if (!endOfDay || !cmr) return null;
    return calculateDashboardMetrics(endOfDay, cmr, activeFilters);
  }, [endOfDay, cmr, activeFilters]);

  const carePathAnalysis = useMemo(() => {
    if (!endOfDay || !cmr) return null;
    const filteredAppts = activeFilters.provider
      ? endOfDay.appointments.filter(a => a.provider.toLowerCase().trim() === activeFilters.provider!.toLowerCase().trim())
      : endOfDay.appointments;
    const filteredCmr = activeFilters.provider
      ? cmr.rows.filter(r => (r.provider ?? '').toLowerCase().trim() === activeFilters.provider!.toLowerCase().trim())
      : cmr.rows;
    return analyzeCarePathIntegrity(filteredAppts, filteredCmr, activeFilters, endOfDay.maxDate);
  }, [endOfDay, cmr, activeFilters]);

  const calculatedWeeks = useMemo(() => {
    if (!endOfDay?.minDate || !endOfDay?.maxDate) return 1;
    const diff = (new Date(endOfDay.maxDate).getTime() - new Date(endOfDay.minDate).getTime()) / 86400000;
    return Math.max(1, Math.ceil(diff / 7));
  }, [endOfDay]);

  const effectiveWeeks = useMemo(() => {
    const wo = parseInt(weeksOverride);
    return wo > 0 ? wo : calculatedWeeks;
  }, [weeksOverride, calculatedWeeks]);

  if (!endOfDay || !cmr || !metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle chart click for weekly drilldown
  const handleWeekClick = (weekLabel: string) => {
    const rows = metrics.weeklyRows.get(weekLabel) || [];
    const cmrRows = metrics.weeklyCmrRows.get(weekLabel) || [];
    setDrilldownWeek(weekLabel);
    setDrilldownRows(rows);
    setDrilldownCmrRows(cmrRows);
    setDrilldownOpen(true);
  };

  const handleNeedsReviewClick = () => {
    operationalRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Build weekly chart data with comparison lines
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

  const weeklyRetChart = metrics.weeklyRetentionRate.map(d => ({
    week: d.week,
    retentionRate: d.value * 100,
  }));

  const weeklyReschChart = metrics.weeklyRescheduled.map(d => ({
    week: d.week,
    rescheduled: d.value,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">KPI Dashboard</h1>
            <p className="text-muted-foreground">
              {endOfDay.minDate && endOfDay.maxDate
                ? `${endOfDay.minDate} — ${endOfDay.maxDate}`
                : 'Date range not available'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(!settingsOpen)} className="gap-1.5">
              <Settings className="h-4 w-4" /> Settings
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Upload New Files
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Settings (collapsible) */}
          {settingsOpen && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard Controls</CardTitle>
                  <CardDescription>Filter data and adjust goals</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Providers</SelectItem>
                        {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Weeks Override</Label>
                    <Input type="number" placeholder={calculatedWeeks.toString()} value={weeksOverride}
                      onChange={e => setWeeksOverride(e.target.value)} min="1" />
                    <p className="text-xs text-muted-foreground">Calculated: {calculatedWeeks} weeks</p>
                  </div>
                  <div className="space-y-2">
                    <Label>ROF Goal (%)</Label>
                    <Input type="number" value={goals.rofRate}
                      onChange={e => setGoals({ ...goals, rofRate: parseFloat(e.target.value) || 0 })} min="0" max="100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Retention Goal (%)</Label>
                    <Input type="number" value={goals.retentionRate}
                      onChange={e => setGoals({ ...goals, retentionRate: parseFloat(e.target.value) || 0 })} min="0" max="100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quarterly Target</Label>
                    <Input type="number" value={goals.quarterlyKept}
                      onChange={e => setGoals({ ...goals, quarterlyKept: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Weekly Target</Label>
                    <Input type="number" value={goals.weeklyKept}
                      onChange={e => setGoals({ ...goals, weeklyKept: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                </CardContent>
              </Card>
              <KeywordsConfig filters={filters} onFiltersChange={setFilters} />
            </div>
          )}

          {/* Provider filter (always visible) */}
          {!settingsOpen && (
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Providers</SelectItem>
                    {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ═══════ TOP LAYER — Executive KPI Cards ═══════ */}
          <KPICards
            metrics={metrics}
            goals={goals}
            weeks={effectiveWeeks}
            patientsNeedingReviewCount={carePathAnalysis?.patientsNeedingReview.length}
            onNeedsReviewClick={handleNeedsReviewClick}
          />

          {/* ═══════ MIDDLE LAYER — Trend & Insight Charts ═══════ */}
          {weeklyComboChart.length > 0 && (
            <div className="space-y-6">
              {/* Weekly Kept with comparison lines */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Kept Appointments</CardTitle>
                  <CardDescription>Completed non-massage appointments per week with comparison lines. Click a data point for details.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={weeklyComboChart} onClick={(e) => {
                      if (e?.activeLabel) handleWeekClick(e.activeLabel);
                    }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <ReferenceLine y={goals.weeklyKept} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
                      <Line type="monotone" dataKey="kept" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Kept" dot={{ fill: 'hsl(var(--primary))', cursor: 'pointer' }} />
                      <Line type="monotone" dataKey="canceled" stroke="hsl(var(--destructive))" strokeWidth={1} strokeDasharray="5 5" name="Canceled" dot={false} opacity={0.6} />
                      <Line type="monotone" dataKey="noShow" stroke="hsl(var(--warning))" strokeWidth={1} strokeDasharray="5 5" name="No-Show" dot={false} opacity={0.6} />
                      <Line type="monotone" dataKey="rescheduled" stroke="hsl(var(--accent))" strokeWidth={1} strokeDasharray="5 5" name="Rescheduled" dot={false} opacity={0.6} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                {/* ROF Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle>ROF Completion Rate by Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyROFChart} onClick={(e) => {
                        if (e?.activeLabel) handleWeekClick(e.activeLabel);
                      }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="week" className="text-xs" />
                        <YAxis className="text-xs" domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
                        <ReferenceLine y={goals.rofRate} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
                        <Bar dataKey="rofCompletionRate" fill="hsl(var(--secondary))" name="ROF %" radius={[4, 4, 0, 0]} cursor="pointer" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Retention Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle>Retention Rate by Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyRetChart} onClick={(e) => {
                        if (e?.activeLabel) handleWeekClick(e.activeLabel);
                      }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="week" className="text-xs" />
                        <YAxis className="text-xs" domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
                        <ReferenceLine y={goals.retentionRate} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
                        <Bar dataKey="retentionRate" fill="hsl(var(--accent))" name="Retention %" radius={[4, 4, 0, 0]} cursor="pointer" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Rescheduled */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Rescheduled Count</CardTitle>
                  <CardDescription>From Report B. Click for details.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyReschChart} onClick={(e) => {
                      if (e?.activeLabel) handleWeekClick(e.activeLabel);
                    }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="rescheduled" fill="hsl(var(--primary))" name="Rescheduled" radius={[4, 4, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reason Breakdown */}
          <ReasonBreakdown
            topCancelReasons={metrics.topCancelReasons}
            topRescheduleReasons={metrics.topRescheduleReasons}
          />

          {/* Reschedule Insights */}
          <RescheduleInsights metrics={metrics} />

          {/* ═══════ BOTTOM LAYER — Operational Intelligence ═══════ */}

          {/* Care Path Integrity */}
          {carePathAnalysis && <CarePathSection analysis={carePathAnalysis} />}

          {/* Provider Comparison Table */}
          {carePathAnalysis && (
            <ProviderComparisonTable
              carePathMetrics={carePathAnalysis.providerMetrics}
              disruptions={metrics.providerDisruptions}
              metrics={metrics}
            />
          )}

          {/* Operational Table */}
          <div ref={operationalRef}>
            <OperationalTable
              endOfDay={endOfDay}
              cmr={cmr}
              filters={activeFilters}
              carePathAnalysis={carePathAnalysis ?? undefined}
              providers={allProviders}
            />
          </div>

          {/* Advanced Parser Diagnostics (collapsed) */}
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">Advanced Parser Diagnostics</CardTitle>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Report A — End-of-Day</h4>
                      <div className="text-sm space-y-1">
                        <p>Appointment rows: <Badge variant="outline">{endOfDay.appointments.length}</Badge></p>
                        <p>Daily totals rows: <Badge variant="outline">{endOfDay.dailyTotals.length}</Badge></p>
                        <p>Providers: <Badge variant="outline">{endOfDay.providers.join(', ') || 'None'}</Badge></p>
                        <p>Date range: <Badge variant="outline">{endOfDay.minDate ?? '?'} → {endOfDay.maxDate ?? '?'}</Badge></p>
                        <p>Rows with patient names: <Badge variant="outline">
                          {endOfDay.appointments.filter(a => a.patientName).length} / {endOfDay.appointments.length}
                        </Badge></p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Report B — Canceled/Missed/Rescheduled</h4>
                      <div className="text-sm space-y-1">
                        <p>Event rows (deduped): <Badge variant="outline">{cmr.rows.length}</Badge></p>
                        <p>Providers: <Badge variant="outline">{cmr.providers.join(', ') || 'None'}</Badge></p>
                        <p>Date range: <Badge variant="outline">{cmr.minDate ?? '?'} → {cmr.maxDate ?? '?'}</Badge></p>
                        <p>Rows with patient names: <Badge variant="outline">
                          {cmr.rows.filter(r => r.patientName).length} / {cmr.rows.length}
                        </Badge></p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Report A — First 10 Rows</h4>
                    <div className="rounded border overflow-auto max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Purpose</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {endOfDay.appointments.slice(0, 10).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{row.date}</TableCell>
                              <TableCell className="text-xs">{row.patientName || '—'}</TableCell>
                              <TableCell className="text-xs">{row.provider}</TableCell>
                              <TableCell className="text-xs">{row.statusRaw}</TableCell>
                              <TableCell className="text-xs">{row.purposeRaw}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Report B — First 10 Rows</h4>
                    <div className="rounded border overflow-auto max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cmr.rows.slice(0, 10).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{row.date}</TableCell>
                              <TableCell className="text-xs">{row.patientName || '—'}</TableCell>
                              <TableCell className="text-xs">{row.provider ?? ''}</TableCell>
                              <TableCell className="text-xs">{row.statusRaw}</TableCell>
                              <TableCell className="text-xs">{row.reasonRaw ?? ''}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Active Keyword Settings</h4>
                    <div className="grid gap-2 md:grid-cols-3 text-xs">
                      <div><span className="font-medium">Completed:</span> {activeFilters.completedKeywords.join(', ')}</div>
                      <div><span className="font-medium">Canceled:</span> {activeFilters.canceledKeywords.join(', ')}</div>
                      <div><span className="font-medium">No Show:</span> {activeFilters.noShowKeywords.join(', ')}</div>
                      <div><span className="font-medium">Rescheduled:</span> {activeFilters.rescheduledKeywords.join(', ')}</div>
                      <div><span className="font-medium">ROF:</span> {activeFilters.rofKeywords.join(', ')}</div>
                      <div><span className="font-medium">Massage:</span> {activeFilters.massageKeywords.join(', ')}</div>
                      <div><span className="font-medium">New Patient:</span> {activeFilters.newPatientKeywords.join(', ')}</div>
                      <div><span className="font-medium">Return Visit:</span> {activeFilters.returnVisitKeywords.join(', ')}</div>
                      <div><span className="font-medium">SC:</span> {activeFilters.supportiveCareKeywords.join(', ')}</div>
                      <div><span className="font-medium">LTC:</span> {activeFilters.ltcKeywords.join(', ')}</div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      {/* Weekly Drilldown Modal */}
      <WeeklyDrilldownModal
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        weekLabel={drilldownWeek}
        rows={drilldownRows}
        cmrRows={drilldownCmrRows}
        filters={activeFilters}
      />
    </div>
  );
};

export default Dashboard;
