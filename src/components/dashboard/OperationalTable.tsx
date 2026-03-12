import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Copy, ChevronLeft, ChevronRight, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { containsAny, normalizeText } from '@/lib/utils/normalize';
import type { ParsedEndOfDay, ParsedCMR, DashboardFilters, UnifiedRow, CarePathClassification } from '@/types/reports';
import type { CarePathAnalysisResult } from '@/types/reports';

interface OperationalTableProps {
  endOfDay: ParsedEndOfDay;
  cmr: ParsedCMR;
  filters: DashboardFilters;
  carePathAnalysis?: CarePathAnalysisResult;
  providers: string[];
}

const PAGE_SIZE = 50;

type TabFilter = 'all' | 'canceled' | 'noshow' | 'rescheduled' | 'checkedout' | 'rof' | 'needsreview';
type SortKey = 'date' | 'patientName' | 'provider' | 'status' | 'visitType';
type SortDir = 'asc' | 'desc';

export const OperationalTable = ({
  endOfDay, cmr, filters, carePathAnalysis, providers,
}: OperationalTableProps) => {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  // Build patient care path flag map
  const patientFlagMap = useMemo(() => {
    const map = new Map<string, CarePathClassification>();
    if (!carePathAnalysis) return map;
    for (const j of carePathAnalysis.patientsNeedingReview) {
      map.set(j.patientName.trim().toLowerCase(), j.classification);
    }
    return map;
  }, [carePathAnalysis]);

  // Build unified rows
  const allRows = useMemo((): UnifiedRow[] => {
    const rows: UnifiedRow[] = [];
    let id = 0;

    for (const a of endOfDay.appointments) {
      const status = normalizeText(a.statusRaw);
      rows.push({
        id: `a-${id++}`,
        date: a.date,
        time: a.scheduledTime,
        patientName: a.patientName,
        provider: a.provider,
        location: a.location,
        visitType: a.purposeRaw,
        status: a.statusRaw,
        sourceReport: 'A',
        isCompleted: containsAny(status, filters.completedKeywords),
        isCanceled: containsAny(status, filters.canceledKeywords),
        isNoShow: containsAny(status, filters.noShowKeywords),
        isRescheduled: containsAny(status, filters.rescheduledKeywords),
        isROF: containsAny(normalizeText(a.purposeRaw), filters.rofKeywords),
        carePathFlag: a.patientName
          ? patientFlagMap.get(a.patientName.trim().toLowerCase())
          : undefined,
      });
    }

    for (const r of cmr.rows) {
      const status = normalizeText(r.statusRaw);
      rows.push({
        id: `b-${id++}`,
        date: r.date,
        time: r.time,
        patientName: r.patientName,
        provider: r.provider || '',
        location: r.location,
        visitType: r.apptTypeRaw,
        status: r.statusRaw,
        reason: r.reasonRaw,
        sourceReport: 'B',
        isCompleted: false,
        isCanceled: containsAny(status, filters.canceledKeywords),
        isNoShow: containsAny(status, filters.noShowKeywords),
        isRescheduled: containsAny(status, filters.rescheduledKeywords),
        isROF: containsAny(normalizeText(r.apptTypeRaw), filters.rofKeywords),
        carePathFlag: r.patientName
          ? patientFlagMap.get(r.patientName.trim().toLowerCase())
          : undefined,
      });
    }

    return rows;
  }, [endOfDay, cmr, filters, patientFlagMap]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Tab filter
    switch (activeTab) {
      case 'canceled': rows = rows.filter(r => r.isCanceled); break;
      case 'noshow': rows = rows.filter(r => r.isNoShow); break;
      case 'rescheduled': rows = rows.filter(r => r.isRescheduled); break;
      case 'checkedout': rows = rows.filter(r => r.isCompleted); break;
      case 'rof': rows = rows.filter(r => r.isROF); break;
      case 'needsreview': rows = rows.filter(r => r.carePathFlag); break;
    }

    // Provider filter
    if (selectedProviders !== 'all') {
      rows = rows.filter(r => r.provider === selectedProviders);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.patientName?.toLowerCase().includes(q)) ||
        r.provider.toLowerCase().includes(q) ||
        r.visitType.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }

    // Sort
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'patientName': cmp = (a.patientName || '').localeCompare(b.patientName || ''); break;
        case 'provider': cmp = a.provider.localeCompare(b.provider); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'visitType': cmp = a.visitType.localeCompare(b.visitType); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [allRows, activeTab, selectedProviders, searchQuery, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const exportCSV = () => {
    const data = filteredRows.map(r => ({
      Date: r.date,
      Time: r.time || '',
      Patient: r.patientName || '',
      Provider: r.provider,
      Location: r.location || '',
      'Visit Type': r.visitType,
      Status: r.status,
      Reason: r.reason || '',
      Source: `Report ${r.sourceReport}`,
      'Care Path Flag': r.carePathFlag || '',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operational-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const copySummary = () => {
    const summary = `Operational Summary (${activeTab} tab)
Total rows: ${filteredRows.length}
Canceled: ${filteredRows.filter(r => r.isCanceled).length}
No-Show: ${filteredRows.filter(r => r.isNoShow).length}
Rescheduled: ${filteredRows.filter(r => r.isRescheduled).length}
Checked Out: ${filteredRows.filter(r => r.isCompleted).length}
ROF: ${filteredRows.filter(r => r.isROF).length}
Needs Review: ${filteredRows.filter(r => r.carePathFlag).length}`;
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard');
  };

  // Check if patient names are missing
  const missingNamePct = allRows.length > 0
    ? (allRows.filter(r => !r.patientName).length / allRows.length) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>Operational Detail</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={copySummary} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copy Summary
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {missingNamePct > 30 && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>
              Patient-level progression analysis is limited because names were removed
              from uploaded reports. Care Path metrics may be incomplete.
            </span>
          </div>
        )}

        {/* Filter controls */}
        <div className="space-y-3">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabFilter); setPage(0); }}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All ({allRows.length})</TabsTrigger>
              <TabsTrigger value="canceled">Canceled</TabsTrigger>
              <TabsTrigger value="noshow">No Show</TabsTrigger>
              <TabsTrigger value="rescheduled">Rescheduled</TabsTrigger>
              <TabsTrigger value="checkedout">Checked Out</TabsTrigger>
              <TabsTrigger value="rof">ROF</TabsTrigger>
              <TabsTrigger value="needsreview">Needs Review</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient, provider, visit type..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={selectedProviders} onValueChange={(v) => { setSelectedProviders(v); setPage(0); }}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row counts */}
        <div className="text-sm text-muted-foreground">
          Showing {paginatedRows.length} of {filteredRows.length} rows (total: {allRows.length})
        </div>

        {/* Table */}
        <div className="rounded border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('date')}>
                  Date{sortIndicator('date')}
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('patientName')}>
                  Patient{sortIndicator('patientName')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('provider')}>
                  Provider{sortIndicator('provider')}
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('visitType')}>
                  Visit Type{sortIndicator('visitType')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                  Status{sortIndicator('status')}
                </TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                  <TableCell className="text-xs">{row.time || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{row.patientName || '—'}</TableCell>
                  <TableCell className="text-xs">{row.provider}</TableCell>
                  <TableCell className="text-xs">{row.location || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate">{row.visitType}</TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge status={row.status} isCompleted={row.isCompleted} isCanceled={row.isCanceled} isNoShow={row.isNoShow} isRescheduled={row.isRescheduled} />
                  </TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate">{row.reason || '—'}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {row.sourceReport === 'A' ? 'Report A' : 'Report B'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.carePathFlag && (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-warning">⚠</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatCarePathFlag(row.carePathFlag)}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {paginatedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No rows match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline" size="sm" disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline" size="sm" disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function StatusBadge({ status, isCompleted, isCanceled, isNoShow, isRescheduled }: {
  status: string; isCompleted: boolean; isCanceled: boolean; isNoShow: boolean; isRescheduled: boolean;
}) {
  if (isCompleted) return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">{status}</Badge>;
  if (isCanceled) return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">{status}</Badge>;
  if (isNoShow) return <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">{status}</Badge>;
  if (isRescheduled) return <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">{status}</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

function formatCarePathFlag(flag: CarePathClassification): string {
  switch (flag) {
    case 'possible_progression_gap': return 'Possible progression gap — visit pattern may warrant review';
    case 'disruption_heavy': return 'Disruption-heavy — multiple cancellations/no-shows';
    case 'needs_review': return 'Needs manual review';
    case 'maintenance_phase_only': return 'Maintenance phase only';
    case 'quarter_boundary_unclear': return 'Near period boundary — follow-through not yet visible';
    case 'progressed_as_expected': return 'Progressed as expected';
    default: return flag;
  }
}
