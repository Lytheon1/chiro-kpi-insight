import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { KPICard } from '@/components/KPICard';
import { WeeklyChart } from '@/components/WeeklyChart';
import { ROFChart } from '@/components/ROFChart';
import { RetentionChart } from '@/components/RetentionChart';
import { DataTable } from '@/components/DataTable';
import { VisitTypeGroups } from '@/components/VisitTypeGroups';
import { AppointmentDetailsDialog } from '@/components/AppointmentDetailsDialog';
import { AppointmentRow, Goals, Keywords, ColumnMapping } from '@/types/dashboard';
import { calculateKPIs, getKPIStatus, calculateWeeklyData, isROF, isCompleted, isMassage, isScheduled } from '@/utils/kpiCalculator';
import { exportToCSV, exportDashboardImage } from '@/utils/exportUtils';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileImage, Loader2, ChevronDown } from 'lucide-react';

const defaultGoals: Goals = {
  rofRate: 74,
  retentionRate: 84,
  quarterlyKept: 390,
  weeklyKept: 30,
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [allRows, setAllRows] = useState<AppointmentRow[]>([]);
  const [dateRange, setDateRange] = useState<{ min: Date | null; max: Date | null }>({ min: null, max: null });
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [weeks, setWeeks] = useState<number>(1);
  const [weeksOverride, setWeeksOverride] = useState<string>('');
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [keywords, setKeywords] = useState<Keywords | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    appointments: AppointmentRow[];
  }>({
    open: false,
    title: '',
    description: '',
    appointments: [],
  });
  
  // Manual adjustments for visit counts
  const [manualCompleted, setManualCompleted] = useState<number>(0);
  const [manualCancelled, setManualCancelled] = useState<number>(0);
  const [manualRescheduled, setManualRescheduled] = useState<number>(0);
  const [manualWeeksOverride, setManualWeeksOverride] = useState<string>('');
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    const dataStr = sessionStorage.getItem('dashboardData');
    if (!dataStr) {
      toast.error('No data found. Please upload a file first.');
      navigate('/');
      return;
    }

    try {
      const data = JSON.parse(dataStr);
      setAllRows(data.rows.map((r: any) => ({
        ...r,
        date: r.date ? new Date(r.date) : undefined,
      })));
      setDateRange({
        min: data.dateRange.min ? new Date(data.dateRange.min) : null,
        max: data.dateRange.max ? new Date(data.dateRange.max) : null,
      });
      setProviders(data.providers || []);
      setWeeks(data.weeks || 1);
      setKeywords(data.keywords);
      setMapping(data.mapping);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load data. Please try uploading again.');
      navigate('/');
    }
  }, [navigate]);

  const filteredRows = useMemo(() => {
    if (selectedProvider === 'All' || !mapping) return allRows;
    return allRows.filter(r => r[mapping.provider] === selectedProvider);
  }, [allRows, selectedProvider, mapping]);

  const effectiveWeeks = useMemo(() => {
    // First check manual adjustments override, then dashboard override, then calculated weeks
    const manualOverride = parseInt(manualWeeksOverride);
    if (manualOverride > 0) return manualOverride;
    
    const dashboardOverride = parseInt(weeksOverride);
    return dashboardOverride > 0 ? dashboardOverride : weeks;
  }, [weeks, weeksOverride, manualWeeksOverride]);

  const metrics = useMemo(() => {
    if (!keywords) return null;
    const baseMetrics = calculateKPIs(filteredRows, keywords, effectiveWeeks);
    
    // Apply manual adjustments
    const adjustedMetrics = {
      ...baseMetrics,
      completedNonMassage: baseMetrics.completedNonMassage + manualCompleted,
      scheduledNonMassage: baseMetrics.scheduledNonMassage + manualCompleted + manualCancelled + manualRescheduled,
      totalKeptNonMassage: baseMetrics.totalKeptNonMassage + manualCompleted,
    };
    
    // Recalculate rates with adjusted values
    adjustedMetrics.retentionRate = adjustedMetrics.scheduledNonMassage > 0 
      ? (adjustedMetrics.completedNonMassage / adjustedMetrics.scheduledNonMassage) * 100 
      : 0;
    adjustedMetrics.weeklyAverage = effectiveWeeks > 0 
      ? adjustedMetrics.completedNonMassage / effectiveWeeks 
      : 0;
    
    return adjustedMetrics;
  }, [filteredRows, keywords, effectiveWeeks, manualCompleted, manualCancelled, manualRescheduled]);

  const weeklyData = useMemo(() => {
    if (!keywords) return [];
    return calculateWeeklyData(filteredRows, keywords, dateRange);
  }, [filteredRows, keywords, dateRange]);

  const handleExportCSV = () => {
    if (!metrics || !keywords) return;
    
    try {
      exportToCSV(metrics, goals, weeklyData, dateRange, effectiveWeeks);
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleExportImage = async () => {
    setIsExporting(true);
    try {
      await exportDashboardImage('dashboard-content');
      toast.success('Dashboard image exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export dashboard image');
    } finally {
      setIsExporting(false);
    }
  };

  if (!metrics || !keywords || !mapping) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rofStatus = getKPIStatus(metrics.rofCompletionRate, goals.rofRate, true);
  const retentionStatus = getKPIStatus(metrics.retentionRate, goals.retentionRate, true);
  const quarterlyStatus = getKPIStatus(metrics.totalKeptNonMassage, goals.quarterlyKept, false);
  const weeklyStatus = getKPIStatus(metrics.weeklyAverage, goals.weeklyKept, false);

  const getROFAppointments = (completedOnly: boolean = false) => {
    return filteredRows.filter(r => {
      const rofMatch = isROF(r, keywords);
      const scheduledMatch = isScheduled(r, keywords);
      if (completedOnly) {
        return rofMatch && isCompleted(r, keywords);
      }
      return rofMatch && scheduledMatch;
    });
  };

  const getRetentionAppointments = (completedOnly: boolean = false) => {
    return filteredRows.filter(r => {
      const nonMassage = !isMassage(r, keywords);
      const scheduledMatch = isScheduled(r, keywords);
      if (completedOnly) {
        return nonMassage && isCompleted(r, keywords);
      }
      return nonMassage && scheduledMatch;
    });
  };

  const handleKPIClick = (kpiType: 'rof' | 'retention' | 'total' | 'weekly') => {
    let title = '';
    let description = '';
    let appointments: AppointmentRow[] = [];

    switch (kpiType) {
      case 'rof':
        appointments = getROFAppointments();
        title = 'ROF Appointments';
        description = `${metrics.completedROF} completed of ${metrics.scheduledROF} scheduled`;
        break;
      case 'retention':
        appointments = getRetentionAppointments();
        title = 'Retention Appointments (Excluding Massage)';
        description = `${metrics.completedNonMassage} completed of ${metrics.scheduledNonMassage} scheduled`;
        break;
      case 'total':
        appointments = getRetentionAppointments(true);
        title = 'Total Kept Appointments (Excluding Massage)';
        description = `${metrics.totalKeptNonMassage} appointments for ${effectiveWeeks} week period`;
        break;
      case 'weekly':
        appointments = getRetentionAppointments(true);
        title = 'Weekly Average Appointments';
        description = `${metrics.weeklyAverage.toFixed(1)} appointments per week`;
        break;
    }

    setDialogState({
      open: true,
      title,
      description,
      appointments,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">KPI Dashboard</h1>
            <p className="text-muted-foreground">
              {dateRange.min && dateRange.max 
                ? `${dateRange.min.toLocaleDateString()} - ${dateRange.max.toLocaleDateString()}`
                : 'Date range not available'
              }
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Upload New File
          </Button>
        </div>

        <div id="dashboard-content" className="space-y-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Controls</CardTitle>
              <CardDescription>Filter data and adjust goals</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-2">
                <Label htmlFor="provider-filter">Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger id="provider-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Providers</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeks-override">Weeks Override</Label>
                <Input
                  id="weeks-override"
                  type="number"
                  placeholder={weeks.toString()}
                  value={weeksOverride}
                  onChange={(e) => setWeeksOverride(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">Override calculated weeks ({weeks}) for all metrics</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rof-goal">ROF Goal (%)</Label>
                <Input
                  id="rof-goal"
                  type="number"
                  value={goals.rofRate}
                  onChange={(e) => setGoals({ ...goals, rofRate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention-goal">Retention Goal (%)</Label>
                <Input
                  id="retention-goal"
                  type="number"
                  value={goals.retentionRate}
                  onChange={(e) => setGoals({ ...goals, retentionRate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarterly-goal">Quarterly Target of Kept Appointments</Label>
                <Input
                  id="quarterly-goal"
                  type="number"
                  value={goals.quarterlyKept}
                  onChange={(e) => setGoals({ ...goals, quarterlyKept: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly-goal">Weekly Target</Label>
                <Input
                  id="weekly-goal"
                  type="number"
                  value={goals.weeklyKept}
                  onChange={(e) => setGoals({ ...goals, weeklyKept: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </CardContent>
          </Card>

          {/* Manual Visit Adjustments */}
          <Collapsible open={isManualOpen} onOpenChange={setIsManualOpen}>
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div>
                      <CardTitle className="text-base">Manual Visit Adjustments</CardTitle>
                      <CardDescription>Add additional visits to calculations</CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isManualOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="manual-completed">Completed Visits</Label>
                      <Input
                        id="manual-completed"
                        type="number"
                        value={manualCompleted}
                        onChange={(e) => setManualCompleted(parseInt(e.target.value) || 0)}
                        min="0"
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Additional completed visits</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-cancelled">Cancelled Visits</Label>
                      <Input
                        id="manual-cancelled"
                        type="number"
                        value={manualCancelled}
                        onChange={(e) => setManualCancelled(parseInt(e.target.value) || 0)}
                        min="0"
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Additional cancelled visits</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-rescheduled">Rescheduled Visits</Label>
                      <Input
                        id="manual-rescheduled"
                        type="number"
                        value={manualRescheduled}
                        onChange={(e) => setManualRescheduled(parseInt(e.target.value) || 0)}
                        min="0"
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Additional rescheduled visits</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-weeks-override">Weeks Override</Label>
                      <Input
                        id="manual-weeks-override"
                        type="number"
                        value={manualWeeksOverride}
                        onChange={(e) => setManualWeeksOverride(e.target.value)}
                        min="1"
                        placeholder={effectiveWeeks.toString()}
                      />
                      <p className="text-xs text-muted-foreground">Override for weekly calculations</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      <strong>Weeks Override:</strong> Controls how many weeks are used to calculate weekly averages and rates. 
                      The system auto-calculates weeks based on your data ({weeks} weeks detected), but you can override this 
                      if your reporting period differs. The Manual Adjustments override takes priority.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="ROF Completion Rate"
              value={`${metrics.rofCompletionRate.toFixed(1)}%`}
              goal={`${goals.rofRate}%`}
              status={rofStatus}
              subtitle={`${metrics.completedROF} of ${metrics.scheduledROF} ROF appointments`}
              variance={`${metrics.rofCompletionRate >= goals.rofRate ? '+' : ''}${(metrics.rofCompletionRate - goals.rofRate).toFixed(1)}% vs goal`}
              onClick={() => handleKPIClick('rof')}
            />
            <KPICard
              title="Retention Rate"
              value={`${metrics.retentionRate.toFixed(1)}%`}
              goal={`${goals.retentionRate}%`}
              status={retentionStatus}
              subtitle="Excluding massage appointments"
              variance={`${metrics.retentionRate >= goals.retentionRate ? '+' : ''}${(metrics.retentionRate - goals.retentionRate).toFixed(1)}% vs goal`}
              onClick={() => handleKPIClick('retention')}
            />
            <KPICard
              title="Total Kept Appointments"
              value={metrics.totalKeptNonMassage}
              goal={goals.quarterlyKept}
              status={quarterlyStatus}
              subtitle={`For ${effectiveWeeks} week period`}
              variance={`${metrics.totalKeptNonMassage >= goals.quarterlyKept ? '+' : ''}${metrics.totalKeptNonMassage - goals.quarterlyKept} vs goal`}
              onClick={() => handleKPIClick('total')}
            />
            <KPICard
              title="Weekly Average"
              value={metrics.weeklyAverage.toFixed(1)}
              goal={goals.weeklyKept}
              status={weeklyStatus}
              subtitle="Kept appointments per week"
              variance={`${metrics.weeklyAverage >= goals.weeklyKept ? '+' : ''}${(metrics.weeklyAverage - goals.weeklyKept).toFixed(1)} vs goal`}
              onClick={() => handleKPIClick('weekly')}
            />
          </div>

          {/* Visit Type Groups */}
          <VisitTypeGroups rows={filteredRows} keywords={keywords} mapping={mapping} />

          {/* Charts */}
          {weeklyData.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-1">
              <WeeklyChart data={weeklyData} />
              <div className="grid gap-6 md:grid-cols-2">
                <ROFChart data={weeklyData} goal={goals.rofRate} />
                <RetentionChart data={weeklyData} goal={goals.retentionRate} />
              </div>
            </div>
          )}

          {/* Data Table */}
          <DataTable rows={filteredRows} mapping={mapping} />
        </div>

        {/* Appointment Details Dialog */}
        <AppointmentDetailsDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState({ ...dialogState, open })}
          title={dialogState.title}
          description={dialogState.description}
          appointments={dialogState.appointments}
          mapping={mapping}
        />

        {/* Export Buttons */}
        <div className="mt-6 flex gap-3 justify-end">
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button 
            onClick={handleExportImage} 
            variant="outline" 
            className="gap-2"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}
            Export Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
