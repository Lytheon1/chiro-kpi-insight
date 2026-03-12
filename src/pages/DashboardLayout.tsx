import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { KeywordsConfig } from '@/components/dashboard/KeywordsConfigPanel';
import { ArrowLeft, Settings, FileCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isSingleProviderMode } from '@/lib/utils/providerColors';
import { loadFiltersFromStorage, saveFiltersToStorage } from '@/lib/utils/keywords';
import type { DashboardFilters } from '@/types/reports';

const navItems = [
  { to: '/executive-brief', label: 'Executive Brief' },
  { to: '/analysis', label: 'Operational Analysis' },
  { to: '/patients', label: 'Patient Review' },
  { to: '/validation', label: 'Validation' },
  { to: '/evidence', label: 'Evidence' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const ctx = useDashboard();
  const {
    isLoaded, endOfDay, filters, setFilters, goals, setGoals,
    selectedProvider, setSelectedProvider, weeksOverride, setWeeksOverride,
    allProviders, calculatedWeeks, loadData,
  } = ctx;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersRestored, setFiltersRestored] = useState(false);

  const singleProvider = isSingleProviderMode(allProviders);

  // Restore filters from localStorage on mount
  useEffect(() => {
    if (!filtersRestored) {
      const saved = loadFiltersFromStorage();
      if (saved) {
        setFilters(saved as DashboardFilters);
      }
      setFiltersRestored(true);
    }
  }, [filtersRestored, setFilters]);

  // Auto-select the sole provider when only one exists
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

  // Active exclusions summary
  const exclusions = [
    ...(filters.excludedPurposeKeywords ?? []),
    ...(filters.massageKeywords ?? []),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-bold tracking-tight hidden sm:block">CTC KPI</h1>
              {isLoaded && (
                <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30 gap-1">
                  <FileCheck className="h-2.5 w-2.5" />
                  {singleProvider && allProviders[0] ? allProviders[0] : 'Data Loaded'}
                </Badge>
              )}
            </div>
            <nav className="flex items-center gap-0.5">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSettingsOpen(!settingsOpen)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate('/')}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        {endOfDay?.minDate && endOfDay?.maxDate && (
          <div className="mb-4 space-y-1">
            <p className="text-xs text-muted-foreground font-mono">
              Report Period: {endOfDay.minDate} — {endOfDay.maxDate}
              {singleProvider && allProviders[0] && (
                <span className="ml-3 font-semibold text-foreground">{allProviders[0]}</span>
              )}
            </p>
            {exclusions.length > 0 && (
              <p className="text-[10px] text-muted-foreground px-2 py-1 rounded bg-muted/50 border inline-block">
                Active exclusions: {exclusions.join(', ')} | Massage excluded from retention
              </p>
            )}
          </div>
        )}

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

        {!settingsOpen && isLoaded && !singleProvider && (
          <div className="flex gap-4 items-end mb-6">
            <div className="space-y-1">
              <Label className="text-xs">Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Providers</SelectItem>
                  {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}
