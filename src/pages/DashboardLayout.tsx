import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { KeywordsConfig } from '@/components/dashboard/KeywordsConfigPanel';
import { ArrowLeft, Settings, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/summary', label: 'Summary' },
  { to: '/patients', label: 'Patients' },
  { to: '/providers', label: 'Providers' },
  { to: '/trends', label: 'Trends' },
  { to: '/diagnostics', label: 'Diagnostics' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const {
    isLoaded, endOfDay, filters, setFilters, goals, setGoals,
    selectedProvider, setSelectedProvider, weeksOverride, setWeeksOverride,
    allProviders, calculatedWeeks,
  } = useDashboard();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load data from session storage if not loaded yet
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
        const { loadData } = useDashboard as any;
      } catch {
        // Context not ready yet
      }
    }
  }, [isLoaded]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold hidden sm:block">CTC KPI Dashboard</h1>
              {isLoaded && (
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                  Data Loaded
                </Badge>
              )}
            </div>
            <nav className="flex items-center gap-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(!settingsOpen)}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        {/* Date range info */}
        {endOfDay?.minDate && endOfDay?.maxDate && (
          <p className="text-sm text-muted-foreground mb-4">
            {endOfDay.minDate} — {endOfDay.maxDate}
          </p>
        )}

        {/* Settings Panel */}
        {settingsOpen && (
          <div className="space-y-4 mb-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 p-4 rounded-lg border bg-card">
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
              </div>
              <div className="space-y-2">
                <Label>ROF Goal (%)</Label>
                <Input type="number" value={goals.rofRate}
                  onChange={e => setGoals({ ...goals, rofRate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Retention Goal (%)</Label>
                <Input type="number" value={goals.retentionRate}
                  onChange={e => setGoals({ ...goals, retentionRate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Quarterly Target</Label>
                <Input type="number" value={goals.quarterlyKept}
                  onChange={e => setGoals({ ...goals, quarterlyKept: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Weekly Target</Label>
                <Input type="number" value={goals.weeklyKept}
                  onChange={e => setGoals({ ...goals, weeklyKept: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <KeywordsConfig filters={filters} onFiltersChange={setFilters} />
          </div>
        )}

        {/* Provider filter (always visible when settings closed) */}
        {!settingsOpen && isLoaded && (
          <div className="flex gap-4 items-end mb-6">
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

        <Outlet />
      </div>
    </div>
  );
}
