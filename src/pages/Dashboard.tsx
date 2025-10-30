import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, Download, FileImage, Loader2 } from 'lucide-react';

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
  
  // Manual entry state
  const [manualEntries, setManualEntries] = useState<AppointmentRow[]>([]);
  const [manualEntryType, setManualEntryType] = useState<string>('completed');
  const [manualEntryProvider, setManualEntryProvider] = useState<string>('');
  const [manualEntryPurpose, setManualEntryPurpose] = useState<string>('');

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

  // Combine original rows with manual entries
  const combinedRows = useMemo(() => {
    return [...allRows, ...manualEntries];
  }, [allRows, manualEntries]);

  const filteredRows = useMemo(() => {
    if (selectedProvider === 'All' || !mapping) return combinedRows;
    return combinedRows.filter(r => r[mapping.provider] === selectedProvider);
  }, [combinedRows, selectedProvider, mapping]);

  const effectiveWeeks = useMemo(() => {
    const override = parseInt(weeksOverride);
    return override > 0 ? override : weeks;
  }, [weeks, weeksOverride]);

  const metrics = useMemo(() => {
    if (!keywords) return null;
    return calculateKPIs(filteredRows, keywords, effectiveWeeks);
  }, [filteredRows, keywords, effectiveWeeks]);

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

  const handleAddManualEntry = () => {
    if (!mapping || !keywords) return;
    
    if (!manualEntryProvider) {
      toast.error('Please select a provider');
      return;
    }

    // Create a manual entry with proper normalization
    const newEntry: AppointmentRow = {
      [mapping.status]: manualEntryType,
      [mapping.provider]: manualEntryProvider,
      [mapping.purpose]: manualEntryPurpose || '',
      [mapping.date]: new Date(),
      [mapping.patient]: 'Manual Entry',
      _statusNormalized: manualEntryType.toLowerCase(),
      _purposeNormalized: manualEntryPurpose.toLowerCase(),
      date: new Date(),
      isManual: true,
    };

    setManualEntries([...manualEntries, newEntry]);
    
    // Reset form
    setManualEntryType('completed');
    setManualEntryProvider('');
    setManualEntryPurpose('');
    
    toast.success(`Manual ${manualEntryType} visit added`);
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
            <CardContent className="space-y-6">
              {/* Manual Entry Section */}
              <div className="pb-6 border-b">
                <h3 className="text-sm font-semibold mb-4">Add Manual Visit</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-2">
                    <Label htmlFor="manual-type">Visit Type</Label>
                    <Select value={manualEntryType} onValueChange={setManualEntryType}>
                      <SelectTrigger id="manual-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="rescheduled">Rescheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-provider">Provider</Label>
                    <Select value={manualEntryProvider} onValueChange={setManualEntryProvider}>
                      <SelectTrigger id="manual-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-purpose">Purpose (Optional)</Label>
                    <Input
                      id="manual-purpose"
                      placeholder="e.g., ROF"
                      value={manualEntryPurpose}
                      onChange={(e) => setManualEntryPurpose(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>&nbsp;</Label>
                    <Button onClick={handleAddManualEntry} className="w-full">
                      Add Visit
                    </Button>
                  </div>
                </div>
                {manualEntries.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {manualEntries.length} manual {manualEntries.length === 1 ? 'entry' : 'entries'} added
                  </p>
                )}
              </div>

              {/* Existing Controls */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
              </div>
            </CardContent>
          </Card>

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
