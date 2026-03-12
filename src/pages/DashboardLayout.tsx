import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDashboard } from '@/lib/context/DashboardContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeywordsConfig } from '@/components/dashboard/KeywordsConfigPanel';
import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isSingleProviderMode } from '@/lib/utils/providerColors';
import { loadFiltersFromStorage, saveFiltersToStorage } from '@/lib/utils/keywords';
import type { DashboardFilters } from '@/types/reports';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/executive-brief': { title: 'Executive Brief', subtitle: 'Doctor View · Operational Summary' },
  '/patient-flow': { title: 'Patient Flow', subtitle: 'Care funnel and retention metrics' },
  '/patients-at-risk': { title: 'Patients at Risk', subtitle: 'Risk scoring and intervention priority' },
  '/analysis': { title: 'Operational Analysis', subtitle: 'Schedule patterns, disruptions, and revenue' },
  '/patients': { title: 'Patient Review', subtitle: 'Individual patient progression review' },
  '/validation': { title: 'Data Validation', subtitle: 'Parser diagnostics and metric confidence' },
  '/evidence': { title: 'Evidence', subtitle: 'Metric evidence and source data' },
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useDashboard();
  const {
    isLoaded, endOfDay, filters, setFilters, goals, setGoals,
    selectedProvider, setSelectedProvider, weeksOverride, setWeeksOverride,
    allProviders, calculatedWeeks, loadData,
  } = ctx;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersRestored, setFiltersRestored] = useState(false);

  const singleProvider = isSingleProviderMode(allProviders);
  const pageMeta = PAGE_META[location.pathname] || { title: '', subtitle: '' };

  useEffect(() => {
    if (!filtersRestored) {
      const saved = loadFiltersFromStorage();
      if (saved) setFilters(saved as DashboardFilters);
      setFiltersRestored(true);
    }
  }, [filtersRestored, setFilters]);

  useEffect(() => {
    if (isLoaded && singleProvider && allProviders.length === 1 && selectedProvider === 'All') {
      setSelectedProvider(allProviders[0]);
    }
  }, [isLoaded, singleProvider, allProviders, selectedProvider, setSelectedProvider]);

  useEffect(() => {
    if (!isLoaded) {
      try {
        const eodStr = sessionStorage.getItem('parsedEndOfDay');
        const cmrStr = sessionStorage.getItem('parsedCMR');
        if (!eodStr || !cmrStr) {
          toast.error('No data found. Please upload files first.');
          navigate('/');
          return;
        }
        loadData(JSON.parse(eodStr), JSON.parse(cmrStr));
      } catch {
        toast.error('Failed to load data.');
        navigate('/');
      }
    }
  }, [isLoaded, loadData, navigate]);

  const handleFiltersChange = (newFilters: DashboardFilters) => {
    setFilters(newFilters);
    saveFiltersToStorage(newFilters);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky Page Header */}
          <header className="bg-card border-b sticky top-0 z-30 px-7 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-7 w-7" />
              <div>
                <h1 className="page-title">{pageMeta.title}</h1>
                {pageMeta.subtitle && (
                  <p className="text-[12px] text-faint mt-0.5">
                    {pageMeta.subtitle}
                    {singleProvider && allProviders[0] ? ` · ${allProviders[0]}` : ''}
                    {endOfDay?.minDate && endOfDay?.maxDate ? ` · ${endOfDay.minDate} — ${endOfDay.maxDate}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isLoaded && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-success/10 text-success border-success/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  Data Loaded
                </Badge>
              )}
              {isLoaded && !singleProvider && (
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-[160px] h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Providers</SelectItem>
                    {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSettingsOpen(!settingsOpen)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <div className="px-7 py-6 max-w-[1400px]">
              {settingsOpen && (
                <div className="space-y-4 mb-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 p-4 rounded-lg border bg-card">
                    {!singleProvider && (
                      <div className="space-y-2">
                        <Label className="text-xs">Provider</Label>
                        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">All Providers</SelectItem>
                            {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs">Weeks Override</Label>
                      <Input className="h-8 text-xs" type="number" placeholder={calculatedWeeks.toString()} value={weeksOverride}
                        onChange={e => setWeeksOverride(e.target.value)} min="1" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">ROF Goal (%)</Label>
                      <Input className="h-8 text-xs" type="number" value={goals.rofRate}
                        onChange={e => setGoals({ ...goals, rofRate: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Retention Goal (%)</Label>
                      <Input className="h-8 text-xs" type="number" value={goals.retentionRate}
                        onChange={e => setGoals({ ...goals, retentionRate: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Quarterly Target</Label>
                      <Input className="h-8 text-xs" type="number" value={goals.quarterlyKept}
                        onChange={e => setGoals({ ...goals, quarterlyKept: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Weekly Target</Label>
                      <Input className="h-8 text-xs" type="number" value={goals.weeklyKept}
                        onChange={e => setGoals({ ...goals, weeklyKept: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <KeywordsConfig filters={filters} onFiltersChange={handleFiltersChange} />
                </div>
              )}
              <Outlet />
            </div>
          </div>

          {/* Footer */}
          <footer className="bg-card border-t px-7 py-3 flex items-center gap-4 text-[11px] text-faint">
            {isLoaded && endOfDay?.minDate && endOfDay?.maxDate && (
              <>
                <span>Lakeside Spine & Wellness · {endOfDay.minDate} — {endOfDay.maxDate}</span>
                {singleProvider && allProviders[0] && <span>Provider: {allProviders[0]}</span>}
                <span>{endOfDay.appointments.length} appointments</span>
                <div className="flex-1" />
                <Badge variant="outline" className="text-[10px] gap-1 bg-success/10 text-success border-success/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  High Confidence
                </Badge>
              </>
            )}
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}