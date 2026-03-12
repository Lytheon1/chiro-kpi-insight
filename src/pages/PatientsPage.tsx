import { useState, useMemo } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { containsAny, normalizeText } from '@/lib/utils/normalize';
import type { CarePathClassification, PatientJourney } from '@/types/reports';

type TabFilter = 'all' | 'needsreview' | 'progression_gap' | 'disruption_heavy' | 'maintenance' | 'quarter_boundary';
type SortKey = 'date' | 'patientName' | 'provider' | 'status' | 'visitType';
const PAGE_SIZE = 50;

const classLabels: Record<CarePathClassification, string> = {
  progressed_as_expected: 'Progressed as Expected',
  maintenance_phase_only: 'Maintenance Phase Only',
  possible_progression_gap: 'Possible Progression Gap',
  quarter_boundary_unclear: 'Quarter-Boundary Unclear',
  disruption_heavy: 'Disruption Heavy',
  needs_review: 'Needs Review',
};

export default function PatientsPage() {
  const { carePathAnalysis, activeFilters, allProviders } = useDashboard();
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('patientName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [selectedJourney, setSelectedJourney] = useState<PatientJourney | null>(null);

  const journeys = carePathAnalysis?.journeys ?? [];
  const patientsNeedingReview = carePathAnalysis?.patientsNeedingReview ?? [];

  const classCounts = useMemo(() => {
    return journeys.reduce<Record<string, number>>((acc, j) => {
      acc[j.classification] = (acc[j.classification] ?? 0) + 1;
      return acc;
    }, {});
  }, [journeys]);

  const needsReviewCount = patientsNeedingReview.length;
  const gapCount = journeys.filter(j => j.classification === 'possible_progression_gap').length;
  const disruptionCount = journeys.filter(j => j.secondaryFlags.includes('disruption_heavy')).length;

  const repeatNoShow = useMemo(() => journeys.filter(j => {
    const ns = j.visits.filter(v => containsAny(normalizeText(v.statusRaw), activeFilters.noShowKeywords)).length;
    return ns >= 2;
  }).length, [journeys, activeFilters]);

  const repeatResch = useMemo(() => journeys.filter(j => {
    const rs = j.visits.filter(v => containsAny(normalizeText(v.statusRaw), activeFilters.rescheduledKeywords)).length;
    return rs >= 2;
  }).length, [journeys, activeFilters]);

  const flatRows = useMemo(() => {
    let jList = journeys;

    switch (tab) {
      case 'needsreview': jList = patientsNeedingReview; break;
      case 'progression_gap': jList = journeys.filter(j => j.classification === 'possible_progression_gap'); break;
      case 'disruption_heavy': jList = journeys.filter(j => j.secondaryFlags.includes('disruption_heavy')); break;
      case 'maintenance': jList = journeys.filter(j => j.classification === 'maintenance_phase_only'); break;
      case 'quarter_boundary': jList = journeys.filter(j => j.classification === 'quarter_boundary_unclear'); break;
    }

    if (selectedProvider !== 'all') {
      jList = jList.filter(j => j.provider === selectedProvider);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      jList = jList.filter(j => j.patientName.toLowerCase().includes(q) || j.provider.toLowerCase().includes(q));
    }

    const rows = jList.flatMap(j =>
      j.visits.map(v => ({
        patientName: j.patientName,
        provider: v.provider,
        date: v.date,
        visitType: v.purposeRaw,
        status: v.statusRaw,
        classification: j.classification,
        secondaryFlags: j.secondaryFlags,
        journey: j,
        visitSequence: j.visits.indexOf(v) + 1,
        isFlagged: j.classification === 'possible_progression_gap' || j.secondaryFlags.includes('disruption_heavy'),
      }))
    );

    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'patientName': cmp = a.patientName.localeCompare(b.patientName); break;
        case 'provider': cmp = a.provider.localeCompare(b.provider); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'visitType': cmp = a.visitType.localeCompare(b.visitType); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [journeys, patientsNeedingReview, tab, selectedProvider, search, sortKey, sortDir]);

  if (!carePathAnalysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No care path analysis available. Upload reports to see patient data.
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(flatRows.length / PAGE_SIZE);
  const paginatedRows = flatRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const exportCSV = () => {
    const data = flatRows.map(r => ({
      Patient: r.patientName,
      Provider: r.provider,
      Date: r.date,
      'Visit Type': r.visitType,
      Status: r.status,
      'Visit #': r.visitSequence,
      Classification: classLabels[r.classification] || r.classification,
      Flagged: r.isFlagged ? 'Yes' : '',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Patients Needing Review
            <Badge variant="outline" className="text-lg">{needsReviewCount}</Badge>
          </CardTitle>
          <CardDescription>
            These are operational flags for manual review. They are not clinical judgments.
            Quarter-boundary and maintenance-only patterns are shown separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="text-xl font-bold">{gapCount}</div>
              <div className="text-xs text-muted-foreground">Possible Progression Gap</div>
            </div>
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="text-xl font-bold">{disruptionCount}</div>
              <div className="text-xs text-muted-foreground">Disruption-Heavy</div>
            </div>
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="text-xl font-bold">{repeatResch}</div>
              <div className="text-xs text-muted-foreground">Repeat Reschedules</div>
            </div>
            <div className="p-3 rounded-md bg-muted/50 border">
              <div className="text-xl font-bold">{repeatNoShow}</div>
              <div className="text-xs text-muted-foreground">Repeat No-Shows</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classification strip */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(classCounts).map(([cls, count]) => (
          <Badge
            key={cls}
            variant="outline"
            className="cursor-pointer hover:bg-accent/50"
            onClick={() => {
              if (cls === 'possible_progression_gap') setTab('progression_gap');
              else if (cls === 'disruption_heavy') setTab('disruption_heavy');
              else if (cls === 'maintenance_phase_only') setTab('maintenance');
              else if (cls === 'quarter_boundary_unclear') setTab('quarter_boundary');
              else setTab('all');
              setPage(0);
            }}
          >
            {classLabels[cls as CarePathClassification] || cls}: {count}
          </Badge>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-base">Patient Operational Table</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as TabFilter); setPage(0); }}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">All ({journeys.length})</TabsTrigger>
                <TabsTrigger value="needsreview">Needs Review ({needsReviewCount})</TabsTrigger>
                <TabsTrigger value="progression_gap">Gap ({gapCount})</TabsTrigger>
                <TabsTrigger value="disruption_heavy">Disruption ({disruptionCount})</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="quarter_boundary">Quarter-Boundary</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patient or provider..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={selectedProvider} onValueChange={v => { setSelectedProvider(v); setPage(0); }}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {paginatedRows.length} of {flatRows.length} rows
          </div>

          <div className="rounded border overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('patientName')}>Patient{sortArrow('patientName')}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('provider')}>Provider{sortArrow('provider')}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('date')}>Date{sortArrow('date')}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('visitType')}>Visit Type{sortArrow('visitType')}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>Status{sortArrow('status')}</TableHead>
                  <TableHead>Visit #</TableHead>
                  <TableHead>⚠ Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs max-w-[120px] truncate">{row.patientName}</TableCell>
                    <TableCell className="text-xs">{row.provider}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate">{row.visitType}</TableCell>
                    <TableCell className="text-xs">{row.status}</TableCell>
                    <TableCell className="text-xs">{row.visitSequence}</TableCell>
                    <TableCell className="text-xs">
                      {row.isFlagged && (
                        <button
                          onClick={() => setSelectedJourney(row.journey)}
                          className="text-warning hover:text-warning/80 text-lg cursor-pointer"
                          title="Click for details"
                        >
                          ⚠
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No rows match.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Flag Explanation Modal */}
      {selectedJourney && (
        <PatientFlagModal
          journey={selectedJourney}
          filters={activeFilters}
          onClose={() => setSelectedJourney(null)}
        />
      )}
    </div>
  );
}

function PatientFlagModal({ journey, filters, onClose }: {
  journey: PatientJourney;
  filters: any;
  onClose: () => void;
}) {
  const reasons: string[] = [];
  const hasROF = journey.visits.some(v => containsAny(normalizeText(v.purposeRaw), filters.rofKeywords));
  const hasActiveTx = journey.visits.some(v => containsAny(normalizeText(v.purposeRaw), filters.returnVisitKeywords));
  const rofVisit = journey.visits.find(v => containsAny(normalizeText(v.purposeRaw), filters.rofKeywords));

  if (journey.classification === 'possible_progression_gap') {
    if (hasROF && !hasActiveTx) {
      reasons.push(`ROF completed on ${rofVisit?.date || 'unknown date'}. No active treatment visits found after ROF in this period.`);
    } else if (hasROF) {
      reasons.push(`ROF completed but patient moved to maintenance-style visits without active treatment phase.`);
    }
  }
  if (journey.secondaryFlags.includes('disruption_heavy') || journey.disruptionCount >= 2) {
    reasons.push(`${journey.disruptionCount} disruption events found (cancel/no-show/reschedule).`);
  }
  if (journey.classification === 'quarter_boundary_unclear') {
    reasons.push(`ROF is near end of period; follow-through may occur next quarter.`);
  }
  if (journey.classification === 'maintenance_phase_only') {
    reasons.push(`Only maintenance-style visits (SC/LTC) visible in this period.`);
  }

  const interpretation = (() => {
    switch (journey.classification) {
      case 'possible_progression_gap': return 'Possible progression gap — treatment path may not have continued as expected.';
      case 'disruption_heavy': return 'Scheduling friction — repeated disruptions may indicate barriers to care.';
      case 'quarter_boundary_unclear': return 'Quarter-boundary — ROF is near end of period; follow-through may occur next quarter.';
      case 'maintenance_phase_only': return 'Maintenance-phase patient — appears to be in SC/LTC continuation phase.';
      default: return 'Visit pattern may warrant a manual look.';
    }
  })();

  const suggestedAction = (() => {
    switch (journey.classification) {
      case 'possible_progression_gap': return 'Review manually to confirm whether treatment plan was completed before this period.';
      case 'disruption_heavy': return 'Consider proactive outreach before next scheduled visit.';
      case 'quarter_boundary_unclear': return 'Monitor only — no action needed if follow-through occurs next quarter.';
      case 'maintenance_phase_only': return 'Confirm whether the SC/LTC transition was intentional.';
      default: return 'Verify with provider whether visit-type labeling is accurate.';
    }
  })();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Why {journey.patientName} is on this list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Visit Sequence</h4>
            <div className="space-y-1">
              {journey.visits.map((v, i) => {
                const isROFv = containsAny(normalizeText(v.purposeRaw), filters.rofKeywords);
                const isNP = containsAny(normalizeText(v.purposeRaw), filters.newPatientKeywords);
                const isMilestone = isROFv || isNP;
                return (
                  <div key={i} className={`text-xs flex gap-3 p-1.5 rounded ${isMilestone ? 'bg-primary/10 font-medium' : ''}`}>
                    <span className="w-20 text-muted-foreground">{v.date}</span>
                    <span className="flex-1">{v.purposeRaw}</span>
                    <span className="text-muted-foreground">{v.statusRaw}</span>
                    <span className="text-muted-foreground">{v.provider}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Flag Reason</h4>
            {reasons.map((r, i) => <p key={i} className="text-sm text-muted-foreground">{r}</p>)}
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Interpretation</h4>
            <p className="text-sm text-muted-foreground italic">{interpretation}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Suggested Next Step</h4>
            <p className="text-sm text-muted-foreground">{suggestedAction}</p>
          </div>
          <p className="text-xs text-muted-foreground italic pt-2 border-t">
            This is an operational flag — not a clinical judgment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
