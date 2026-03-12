import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, ChevronLeft, ChevronRight, Search, AlertTriangle, ArrowRight, X, Eye, List } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { containsAny, normalizeText } from '@/lib/utils/normalize';
import type { CarePathClassification, PatientJourney } from '@/types/reports';

type TabFilter = 'all' | 'needsreview' | 'progression_gap' | 'disruption_heavy' | 'maintenance' | 'quarter_boundary' | 'repeat_reschedule';
type SortKey = 'date' | 'patientName' | 'provider' | 'status' | 'visitType';
type EvidenceMode = 'evidence' | 'full_journey';
const PAGE_SIZE = 50;

const classLabels: Record<CarePathClassification, string> = {
  progressed_as_expected: 'Progressed as Expected',
  maintenance_phase_only: 'Maintenance Phase Only',
  possible_progression_gap: 'Possible Progression Gap',
  quarter_boundary_unclear: 'Quarter-Boundary Unclear',
  disruption_heavy: 'Disruption Heavy',
  needs_review: 'Needs Review',
};

const filterLabels: Record<TabFilter, string> = {
  all: 'All',
  needsreview: 'Needs Review',
  progression_gap: 'Progression Gap',
  disruption_heavy: 'Disruption-Heavy Patients',
  maintenance: 'Maintenance',
  quarter_boundary: 'Quarter-Boundary',
  repeat_reschedule: 'Repeat-Rescheduled',
};

/** Check if a row is a disruption event */
function isDisruptionRow(statusRaw: string, cancelKw: string[], noShowKw: string[], reschKw: string[]): boolean {
  const s = normalizeText(statusRaw);
  return containsAny(s, cancelKw) || containsAny(s, noShowKw) || containsAny(s, reschKw);
}

/** Check if a row is a milestone (NP, ROF, Re-Exam, SC, LTC) */
function isMilestoneRow(purposeRaw: string): boolean {
  const p = purposeRaw.toLowerCase();
  return p.includes('new patient') || p.includes('rof') || p.includes('report of findings') ||
    p.includes('re-exam') || p.includes('supportive care') || p.includes('ltc');
}

export default function PatientReviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { carePathAnalysis, cmr, activeFilters, allProviders } = useDashboard();

  const urlFilter = searchParams.get('filter');
  const initialTab: TabFilter = (urlFilter && urlFilter in filterLabels) ? urlFilter as TabFilter : 'all';

  const [tab, setTab] = useState<TabFilter>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('patientName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [selectedJourney, setSelectedJourney] = useState<PatientJourney | null>(null);
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>('evidence');

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f && f in filterLabels && f !== tab) {
      setTab(f as TabFilter);
      setPage(0);
    }
  }, [searchParams]);

  const journeys = carePathAnalysis?.journeys ?? [];
  const patientsNeedingReview = carePathAnalysis?.patientsNeedingReview ?? [];

  const classCounts = useMemo(() =>
    journeys.reduce<Record<string, number>>((acc, j) => {
      acc[j.classification] = (acc[j.classification] ?? 0) + 1;
      return acc;
    }, {}), [journeys]);

  const needsReviewCount = patientsNeedingReview.length;
  const gapCount = journeys.filter(j => j.classification === 'possible_progression_gap').length;
  const disruptionCount = journeys.filter(j => j.secondaryFlags.includes('disruption_heavy')).length;

  const repeatReschedulePatients = useMemo(() => {
    if (!cmr) return { names: new Set<string>(), rows: [] as typeof cmr.rows };
    const reschKeywords = activeFilters.rescheduledKeywords;
    const byPatient = new Map<string, typeof cmr.rows>();
    for (const row of cmr.rows) {
      if (!row.patientName) continue;
      const status = normalizeText(row.statusRaw);
      if (!containsAny(status, reschKeywords)) continue;
      const key = row.patientName.trim().toLowerCase();
      if (!byPatient.has(key)) byPatient.set(key, []);
      byPatient.get(key)!.push(row);
    }
    const names = new Set<string>();
    const rows: typeof cmr.rows = [];
    for (const [key, pRows] of byPatient) {
      if (pRows.length >= 2) {
        names.add(key);
        rows.push(...pRows);
      }
    }
    return { names, rows };
  }, [cmr, activeFilters.rescheduledKeywords]);

  const repeatResch = repeatReschedulePatients.names.size;

  const repeatNoShow = useMemo(() => journeys.filter(j => {
    const ns = j.visits.filter(v => containsAny(normalizeText(v.statusRaw), activeFilters.noShowKeywords)).length;
    return ns >= 2;
  }).length, [journeys, activeFilters]);

  // ─── Evidence-aware row building ────────────────────────────────────────────
  const flatRows = useMemo(() => {
    // For repeat_reschedule tab, build rows from CMR data
    if (tab === 'repeat_reschedule') {
      let cmrRows = repeatReschedulePatients.rows;
      if (selectedProvider !== 'all') cmrRows = cmrRows.filter(r => r.provider === selectedProvider);
      if (search.trim()) {
        const q = search.toLowerCase();
        cmrRows = cmrRows.filter(r =>
          (r.patientName || '').toLowerCase().includes(q) ||
          (r.provider || '').toLowerCase().includes(q)
        );
      }
      const rows = cmrRows.map((r, i) => ({
        patientName: r.patientName || 'Unknown',
        provider: r.provider || '',
        date: r.date,
        visitType: r.apptTypeRaw,
        status: r.statusRaw,
        classification: 'needs_review' as CarePathClassification,
        secondaryFlags: [] as string[],
        journey: null as any,
        visitSequence: 0,
        isFlagged: true,
        isEvidenceRow: true,
      }));
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
    }

    let jList = journeys;
    switch (tab) {
      case 'needsreview': jList = patientsNeedingReview; break;
      case 'progression_gap': jList = journeys.filter(j => j.classification === 'possible_progression_gap'); break;
      case 'disruption_heavy': jList = journeys.filter(j => j.secondaryFlags.includes('disruption_heavy')); break;
      case 'maintenance': jList = journeys.filter(j => j.classification === 'maintenance_phase_only'); break;
      case 'quarter_boundary': jList = journeys.filter(j => j.classification === 'quarter_boundary_unclear'); break;
    }
    if (selectedProvider !== 'all') jList = jList.filter(j => j.provider === selectedProvider);
    if (search.trim()) {
      const q = search.toLowerCase();
      jList = jList.filter(j => j.patientName.toLowerCase().includes(q) || j.provider.toLowerCase().includes(q));
    }

    const rows = jList.flatMap(j =>
      j.visits.map(v => {
        // Determine if this row is evidence for the current filter
        let isEvidenceRow = true; // default: show all for 'all' tab
        if (tab === 'disruption_heavy') {
          isEvidenceRow = isDisruptionRow(v.statusRaw, activeFilters.canceledKeywords, activeFilters.noShowKeywords, activeFilters.rescheduledKeywords);
        } else if (tab === 'progression_gap') {
          isEvidenceRow = isMilestoneRow(v.purposeRaw);
        }

        return {
          patientName: j.patientName, provider: v.provider, date: v.date,
          visitType: v.purposeRaw, status: v.statusRaw,
          classification: j.classification, secondaryFlags: j.secondaryFlags, journey: j,
          visitSequence: j.visits.indexOf(v) + 1,
          isFlagged: j.classification === 'possible_progression_gap' || j.secondaryFlags.includes('disruption_heavy'),
          isEvidenceRow,
        };
      })
    );

    // In evidence mode, filter to only evidence rows (for disruption/gap tabs)
    const filtered = (evidenceMode === 'evidence' && (tab === 'disruption_heavy' || tab === 'progression_gap'))
      ? rows.filter(r => r.isEvidenceRow)
      : rows;

    filtered.sort((a, b) => {
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
    return filtered;
  }, [journeys, patientsNeedingReview, tab, selectedProvider, search, sortKey, sortDir, activeFilters, repeatReschedulePatients, evidenceMode]);

  // Unique patient count for current view
  const uniquePatientCount = useMemo(() => {
    const names = new Set(flatRows.map(r => r.patientName.toLowerCase()));
    return names.size;
  }, [flatRows]);

  if (!carePathAnalysis) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Upload reports to see patient data.</CardContent></Card>;
  }

  const totalPages = Math.ceil(flatRows.length / PAGE_SIZE);
  const paginatedRows = flatRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const handleSummaryClick = (filter: TabFilter) => {
    setTab(filter);
    setPage(0);
    setEvidenceMode('evidence');
    setSearchParams({ filter });
  };

  const clearFilter = () => {
    setTab('all');
    setSearchParams({});
    setPage(0);
    setEvidenceMode('evidence');
  };

  const exportCSV = () => {
    const data = flatRows.map(r => ({
      Patient: r.patientName, Provider: r.provider, Date: r.date,
      'Visit Type': r.visitType, Status: r.status, 'Visit #': r.visitSequence,
      Classification: classLabels[r.classification] || r.classification, Flagged: r.isFlagged ? 'Yes' : '',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patient-review-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  const showEvidenceToggle = tab === 'disruption_heavy' || tab === 'progression_gap';

  return (
    <div className="space-y-4">
      {/* Summary boxes — clickable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Patients Needing Review
            <Badge variant="outline" className="text-base">{needsReviewCount}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Click any box below to filter the table to those patients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Progression Gap', value: gapCount, filter: 'progression_gap' as TabFilter },
              { label: 'Disruption-Heavy', value: disruptionCount, filter: 'disruption_heavy' as TabFilter },
              { label: 'Repeat Reschedules', value: repeatResch, filter: 'repeat_reschedule' as TabFilter },
              { label: 'Repeat No-Shows', value: repeatNoShow, filter: 'needsreview' as TabFilter },
            ].map(s => (
              <div
                key={s.label}
                className={`p-2.5 rounded border cursor-pointer transition-all hover:shadow-md hover:border-secondary ${tab === s.filter ? 'bg-secondary/10 border-secondary' : 'bg-muted/30'}`}
                onClick={() => handleSummaryClick(s.filter)}
              >
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
                <div className="text-[9px] text-secondary font-medium mt-0.5">Click to filter →</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Classification chips */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(classCounts).map(([cls, count]) => {
          const targetTab: TabFilter =
            cls === 'possible_progression_gap' ? 'progression_gap' :
            cls === 'disruption_heavy' ? 'disruption_heavy' :
            cls === 'maintenance_phase_only' ? 'maintenance' :
            cls === 'quarter_boundary_unclear' ? 'quarter_boundary' :
            'all';
          return (
            <Badge
              key={cls} variant="outline"
              className={`cursor-pointer hover:bg-accent/50 text-[10px] ${tab === targetTab ? 'bg-secondary/20 border-secondary' : ''}`}
              onClick={() => handleSummaryClick(targetTab)}
            >
              {classLabels[cls as CarePathClassification] || cls}: {count}
            </Badge>
          );
        })}
      </div>

      {/* Active filter + evidence toggle */}
      {tab !== 'all' && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1.5 py-1">
              Showing: {filterLabels[tab]}
              <button onClick={clearFilter} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {uniquePatientCount} patients · {flatRows.length} rows
            </span>
          </div>

          {/* Evidence / Full Journey toggle */}
          {showEvidenceToggle && (
            <div className="flex border rounded overflow-hidden">
              <button
                className={`px-2.5 py-1 text-[10px] flex items-center gap-1 ${evidenceMode === 'evidence' ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:bg-accent/50'}`}
                onClick={() => { setEvidenceMode('evidence'); setPage(0); }}
              >
                <Eye className="h-3 w-3" /> Evidence Rows
              </button>
              <button
                className={`px-2.5 py-1 text-[10px] flex items-center gap-1 ${evidenceMode === 'full_journey' ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:bg-accent/50'}`}
                onClick={() => { setEvidenceMode('full_journey'); setPage(0); }}
              >
                <List className="h-3 w-3" /> Full Journey
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter explanation banners */}
      {tab === 'disruption_heavy' && (
        <div className="text-[11px] p-2.5 rounded bg-muted/50 border text-muted-foreground">
          <strong className="text-primary">Disruption-Heavy Patients ({disruptionCount})</strong> — patients with 2+ disruption events (cancel/no-show/reschedule).
          {evidenceMode === 'evidence'
            ? ' Showing only disruption event rows. Toggle "Full Journey" to see all visits.'
            : ' Showing all visit rows including completed appointments.'}
        </div>
      )}
      {tab === 'progression_gap' && (
        <div className="text-[11px] p-2.5 rounded bg-muted/50 border text-muted-foreground">
          <strong className="text-primary">Progression Gap ({gapCount})</strong> — patients whose care path shows a milestone gap (e.g., ROF completed but no active treatment followed).
          {evidenceMode === 'evidence'
            ? ' Showing only milestone rows (NP, ROF, SC, LTC). Toggle "Full Journey" for context.'
            : ' Showing all visit rows.'}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-xs font-medium">
              {tab !== 'all'
                ? `${filterLabels[tab]} — ${uniquePatientCount} patients, ${flatRows.length} rows`
                : `Patient Operational Table — ${flatRows.length} rows`}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-7 text-xs">
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as TabFilter); setPage(0); setEvidenceMode('evidence'); }}>
            <TabsList className="flex-wrap h-auto gap-0.5">
              <TabsTrigger value="all" className="text-[10px] h-7">All ({journeys.length})</TabsTrigger>
              <TabsTrigger value="needsreview" className="text-[10px] h-7">Needs Review ({needsReviewCount})</TabsTrigger>
              <TabsTrigger value="progression_gap" className="text-[10px] h-7">Gap ({gapCount})</TabsTrigger>
              <TabsTrigger value="disruption_heavy" className="text-[10px] h-7">Disruption ({disruptionCount})</TabsTrigger>
              <TabsTrigger value="maintenance" className="text-[10px] h-7">Maintenance</TabsTrigger>
              <TabsTrigger value="quarter_boundary" className="text-[10px] h-7">Quarter</TabsTrigger>
              <TabsTrigger value="repeat_reschedule" className="text-[10px] h-7">Repeat Resch ({repeatResch})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search patient or provider..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={selectedProvider} onValueChange={v => { setSelectedProvider(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="text-[10px] text-muted-foreground">
            {paginatedRows.length} of {flatRows.length} rows · {uniquePatientCount} unique patients
          </div>

          <div className="rounded border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('patientName')}>Patient{sortArrow('patientName')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('provider')}>Provider{sortArrow('provider')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('date')}>Date{sortArrow('date')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('visitType')}>Visit Type{sortArrow('visitType')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('status')}>Status{sortArrow('status')}</TableHead>
                  <TableHead className="text-[10px]">Visit #</TableHead>
                  <TableHead className="text-[10px]">⚠</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row, i) => (
                  <TableRow key={i} className={!row.isEvidenceRow && evidenceMode === 'full_journey' ? 'opacity-50' : ''}>
                    <TableCell className="text-[10px] max-w-[100px] truncate">{row.patientName}</TableCell>
                    <TableCell className="text-[10px]">{row.provider}</TableCell>
                    <TableCell className="text-[10px] whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className="text-[10px] max-w-[120px] truncate">{row.visitType}</TableCell>
                    <TableCell className="text-[10px]">{row.status}</TableCell>
                    <TableCell className="text-[10px]">{row.visitSequence}</TableCell>
                    <TableCell className="text-[10px]">
                      {row.isFlagged && row.journey && (
                        <button onClick={() => setSelectedJourney(row.journey)}
                          className="text-warning hover:text-warning/80 cursor-pointer" title="View details">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedRows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No rows match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">
                <ChevronLeft className="h-3 w-3 mr-1" /> Prev
              </Button>
              <span className="text-[10px] text-muted-foreground">Page {page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">
                Next <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flag Modal */}
      {selectedJourney && (
        <PatientFlagModal journey={selectedJourney} filters={activeFilters} onClose={() => setSelectedJourney(null)} onShowEvidence={() => { setSelectedJourney(null); navigate('/evidence'); }} />
      )}
    </div>
  );
}

function PatientFlagModal({ journey, filters, onClose, onShowEvidence }: {
  journey: PatientJourney; filters: any; onClose: () => void; onShowEvidence: () => void;
}) {
  const reasons: string[] = [];
  const hasROF = journey.visits.some(v => containsAny(normalizeText(v.purposeRaw), filters.rofKeywords));
  const hasActiveTx = journey.visits.some(v =>
    containsAny(normalizeText(v.purposeRaw), filters.returnVisitKeywords) ||
    (filters.tractionKeywords && containsAny(normalizeText(v.purposeRaw), filters.tractionKeywords)) ||
    (filters.therapyKeywords && containsAny(normalizeText(v.purposeRaw), filters.therapyKeywords))
  );
  const rofVisit = journey.visits.find(v => containsAny(normalizeText(v.purposeRaw), filters.rofKeywords));

  if (journey.classification === 'possible_progression_gap') {
    if (hasROF && !hasActiveTx) {
      reasons.push(`ROF completed on ${rofVisit?.date || 'unknown date'}. No active treatment visits found after ROF in this period.`);
    } else if (hasROF) {
      const scVisit = journey.visits.find(v => containsAny(normalizeText(v.purposeRaw), filters.supportiveCareKeywords));
      if (scVisit && rofVisit) {
        reasons.push(`ROF on ${rofVisit.date} was followed by Supportive Care on ${scVisit.date} with no active treatment visits between.`);
      } else {
        reasons.push(`ROF completed but patient moved to maintenance-style visits without active treatment phase.`);
      }
    }
  }
  if (journey.secondaryFlags.includes('disruption_heavy') || journey.disruptionCount >= 2) {
    reasons.push(`${journey.disruptionCount} disruption events found (cancel/no-show/reschedule).`);
  }
  if (journey.classification === 'quarter_boundary_unclear') {
    const endNote = rofVisit ? `ROF completed on ${rofVisit.date}, near report end.` : 'Milestone visit near end of period.';
    reasons.push(`${endNote} Follow-through may occur next quarter.`);
  }
  if (journey.classification === 'maintenance_phase_only') {
    reasons.push(`Only maintenance-style visits (SC/LTC) visible in this period.`);
  }

  const interpretation = (() => {
    switch (journey.classification) {
      case 'possible_progression_gap': return 'Possible progression gap — treatment path may not have continued as expected.';
      case 'disruption_heavy': return 'Scheduling friction — repeated disruptions may indicate barriers to care.';
      case 'quarter_boundary_unclear': return 'Quarter-boundary — follow-through may occur next quarter.';
      case 'maintenance_phase_only': return 'Maintenance-phase patient — appears to be in SC/LTC continuation phase.';
      default: return 'Visit pattern may warrant a manual review.';
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
          <DialogTitle className="text-sm">Why {journey.patientName} is flagged</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold mb-2">Visit Sequence</h4>
            <div className="space-y-0.5">
              {journey.visits.map((v, i) => {
                const isROFv = containsAny(normalizeText(v.purposeRaw), filters.rofKeywords);
                const isNP = containsAny(normalizeText(v.purposeRaw), filters.newPatientKeywords);
                const isActiveTxV = containsAny(normalizeText(v.purposeRaw), filters.returnVisitKeywords) ||
                  (filters.tractionKeywords && containsAny(normalizeText(v.purposeRaw), filters.tractionKeywords)) ||
                  (filters.therapyKeywords && containsAny(normalizeText(v.purposeRaw), filters.therapyKeywords));
                const isMaint = containsAny(normalizeText(v.purposeRaw), filters.supportiveCareKeywords) ||
                  containsAny(normalizeText(v.purposeRaw), filters.ltcKeywords);
                const isMilestone = isROFv || isNP || (i === 0 && isActiveTxV);

                return (
                  <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded text-[10px] ${isMilestone ? 'bg-primary/5 font-medium' : ''}`}>
                    <span className="font-mono w-[72px] shrink-0">{v.date}</span>
                    <span className="w-[120px] truncate">{v.purposeRaw}</span>
                    <span className="w-[80px] truncate text-muted-foreground">{v.provider}</span>
                    <span className="text-muted-foreground">{v.statusRaw}</span>
                    {isNP && <Badge variant="outline" className="text-[8px] h-4">NP</Badge>}
                    {isROFv && <Badge variant="outline" className="text-[8px] h-4">ROF</Badge>}
                    {isActiveTxV && <Badge variant="outline" className="text-[8px] h-4 bg-success/10 text-success border-success/30">Tx</Badge>}
                    {isMaint && <Badge variant="outline" className="text-[8px] h-4 bg-warning/10 text-warning border-warning/30">Maint</Badge>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {reasons.length > 0 && (
              <div>
                <h4 className="font-semibold text-[11px] mb-1">Explanation</h4>
                {reasons.map((r, i) => <p key={i} className="text-muted-foreground">{r}</p>)}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-[11px] mb-1">Interpretation</h4>
              <p className="text-muted-foreground">{interpretation}</p>
            </div>
            <div>
              <h4 className="font-semibold text-[11px] mb-1">Suggested Next Step</h4>
              <p className="text-muted-foreground">{suggestedAction}</p>
            </div>
          </div>

          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onShowEvidence}>
            Show source rows <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
