import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICards } from '@/components/dashboard/KPICards';
import { DebugParserPanel } from '@/components/dashboard/DebugParserPanel';
import { ReasonBreakdown } from '@/components/dashboard/ReasonBreakdown';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { ParsedEndOfDay, ParsedCMR, DashboardFilters, DashboardMetrics } from '@/types/reports';
import { calculateDashboardMetrics, DEFAULT_FILTERS } from '@/lib/kpi/calculateDashboardMetrics';

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [endOfDay, setEndOfDay] = useState<ParsedEndOfDay | null>(null);
  const [cmr, setCmr] = useState<ParsedCMR | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [weeksOverride, setWeeksOverride] = useState<string>('');
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  useEffect(() => {
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
  }, [navigate]);

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

  // Convert weekly data for charts (rates are 0-1, convert to %)
  const weeklyKeptChart = metrics.weeklyKept.map(d => ({ weekStart: d.week, keptAppointments: d.value }));
  const weeklyROFChart = metrics.weeklyROFRate.map(d => ({ weekStart: d.week, rofCompletionRate: d.value * 100 }));
  const weeklyRetChart = metrics.weeklyRetentionRate.map(d => ({ weekStart: d.week, retentionRate: d.value * 100 }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">KPI Dashboard</h1>
            <p className="text-muted-foreground">
              {endOfDay.minDate && endOfDay.maxDate
                ? `${endOfDay.minDate} — ${endOfDay.maxDate}`
                : 'Date range not available'}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Upload New Files
          </Button>
        </div>

        <div className="space-y-6">
          {/* Controls */}
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
                    {allProviders.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Weeks Override</Label>
                <Input
                  type="number"
                  placeholder={calculatedWeeks.toString()}
                  value={weeksOverride}
                  onChange={(e) => setWeeksOverride(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">Calculated: {calculatedWeeks} weeks</p>
              </div>
              <div className="space-y-2">
                <Label>ROF Goal (%)</Label>
                <Input
                  type="number"
                  value={goals.rofRate}
                  onChange={(e) => setGoals({ ...goals, rofRate: parseFloat(e.target.value) || 0 })}
                  min="0" max="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Retention Goal (%)</Label>
                <Input
                  type="number"
                  value={goals.retentionRate}
                  onChange={(e) => setGoals({ ...goals, retentionRate: parseFloat(e.target.value) || 0 })}
                  min="0" max="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Quarterly Target</Label>
                <Input
                  type="number"
                  value={goals.quarterlyKept}
                  onChange={(e) => setGoals({ ...goals, quarterlyKept: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Weekly Target</Label>
                <Input
                  type="number"
                  value={goals.weeklyKept}
                  onChange={(e) => setGoals({ ...goals, weeklyKept: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <KPICards metrics={metrics} goals={goals} weeks={effectiveWeeks} />

          {/* Charts */}
          {weeklyKeptChart.length > 0 && (
            <div className="space-y-6">
              {/* Weekly Kept */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Kept Appointments</CardTitle>
                  <CardDescription>Completed non-massage appointments per week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={weeklyKeptChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="weekStart" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                      <ReferenceLine y={goals.weeklyKept} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
                      <Line type="monotone" dataKey="keptAppointments" stroke="hsl(var(--primary))" strokeWidth={2} name="Kept" dot={{ fill: 'hsl(var(--primary))' }} />
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
                      <BarChart data={weeklyROFChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="weekStart" className="text-xs" />
                        <YAxis className="text-xs" domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <ReferenceLine y={goals.rofRate} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
                        <Bar dataKey="rofCompletionRate" fill="hsl(var(--secondary))" name="ROF %" radius={[4, 4, 0, 0]} />
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
                      <BarChart data={weeklyRetChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="weekStart" className="text-xs" />
                        <YAxis className="text-xs" domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <ReferenceLine y={goals.retentionRate} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
                        <Bar dataKey="retentionRate" fill="hsl(var(--accent))" name="Retention %" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Reason Breakdown */}
          <ReasonBreakdown
            topCancelReasons={metrics.topCancelReasons}
            topRescheduleReasons={metrics.topRescheduleReasons}
          />

          {/* Debug Panel */}
          <DebugParserPanel endOfDay={endOfDay} cmr={cmr} filters={activeFilters} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
