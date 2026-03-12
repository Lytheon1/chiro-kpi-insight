/**
 * DrilldownPanel — shared component for displaying drilldown datasets.
 * Shows filter chip, formula summary, evidence/journey toggle, and patient/row table.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, Eye, List, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import type { DrilldownDataset, DrilldownPatient, EvidenceMode } from '@/lib/drilldown/types';

interface DrilldownPanelProps {
  dataset: DrilldownDataset;
  onClose: () => void;
  /** For percentage metrics: tabs to filter numerator/denominator/failed */
  showTabs?: boolean;
  /** External label for augmented datasets (e.g. "_isContinued" property on patients) */
  tabFilter?: 'all' | 'numerator' | 'failed';
  onTabChange?: (tab: 'all' | 'numerator' | 'failed') => void;
}

const PAGE_SIZE = 30;

export function DrilldownPanel({ dataset, onClose, showTabs, tabFilter = 'all', onTabChange }: DrilldownPanelProps) {
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>('evidence');
  const [page, setPage] = useState(0);

  const isPercentage = dataset.summary.denominator !== undefined && dataset.summary.pct !== undefined;

  // Filter patients by tab
  const filteredPatients = useMemo(() => {
    if (!showTabs || tabFilter === 'all') return dataset.patients;
    // Check if patients have _isContinued flag (care continuation specific)
    return dataset.patients.filter((p: any) => {
      if (tabFilter === 'numerator') return p._isContinued === true;
      if (tabFilter === 'failed') return p._isContinued === false;
      return true;
    });
  }, [dataset.patients, tabFilter, showTabs]);

  // Build display rows
  const displayRows = useMemo(() => {
    if (dataset.mode === 'patient') {
      // Patient-level: one row per patient
      return filteredPatients.map(p => ({
        patientName: p.patientName,
        provider: p.provider,
        date: p.lastVisitDate,
        visitType: p.stages?.join(', ') || '—',
        status: `${p.completedVisitCount} visits`,
        isEvidence: true,
        riskScore: p.riskScore,
      }));
    }

    // Event or journey mode: show rows
    return filteredPatients.flatMap(p => {
      const rows = evidenceMode === 'evidence' ? p.evidenceRows : (p.fullJourneyRows || p.evidenceRows);
      return rows.map(r => ({
        patientName: r.patientName,
        provider: r.provider,
        date: r.date,
        visitType: r.visitType,
        status: r.status,
        isEvidence: r.isEvidence,
        milestoneLabel: r.milestoneLabel,
      }));
    });
  }, [filteredPatients, evidenceMode, dataset.mode]);

  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const paginatedRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCSV = () => {
    const data = displayRows.map(r => ({
      Patient: r.patientName,
      Provider: r.provider,
      Date: r.date,
      'Visit Type': r.visitType,
      Status: r.status,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `drilldown-${dataset.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  return (
    <Card className="border-secondary/40 bg-secondary/[0.02]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            {/* Filter chip */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs gap-1.5 py-1">
                Showing: {dataset.label}
                <button onClick={onClose} className="hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {dataset.mode === 'patient' ? 'Patient-level' : 'Event-level'} · {displayRows.length} rows
              </span>
            </div>

            {/* Formula summary for percentage metrics */}
            {isPercentage && (
              <div className="text-[11px] p-2.5 rounded bg-muted/50 border space-y-0.5">
                <div className="font-medium text-primary">{dataset.label}: {dataset.summary.pct!.toFixed(1)}%</div>
                <div className="text-muted-foreground">
                  <span className="font-mono">{dataset.summary.formula}</span>
                </div>
                <div className="text-faint text-[10px]">
                  Numerator: {dataset.summary.numerator} · Denominator: {dataset.summary.denominator} · Showing: {displayRows.length} rows
                </div>
              </div>
            )}

            {/* Description */}
            <div className="text-[10px] text-muted-foreground">{dataset.description}</div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Evidence/Journey toggle for event/journey modes */}
            {(dataset.mode === 'event' || dataset.mode === 'journey') && (
              <div className="flex border rounded overflow-hidden">
                <button
                  className={`px-2 py-1 text-[10px] ${evidenceMode === 'evidence' ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:bg-accent/50'}`}
                  onClick={() => { setEvidenceMode('evidence'); setPage(0); }}
                >
                  <Eye className="h-3 w-3 inline mr-0.5" /> Evidence
                </button>
                <button
                  className={`px-2 py-1 text-[10px] ${evidenceMode === 'full_journey' ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:bg-accent/50'}`}
                  onClick={() => { setEvidenceMode('full_journey'); setPage(0); }}
                >
                  <List className="h-3 w-3 inline mr-0.5" /> Full Journey
                </button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-7 text-[10px]">
              <Download className="h-3 w-3" /> CSV
            </Button>
          </div>
        </div>

        {/* Tabs for percentage metrics */}
        {showTabs && isPercentage && onTabChange && (
          <div className="flex gap-1 mt-2">
            {[
              { key: 'all' as const, label: `All (${dataset.summary.denominator})` },
              { key: 'numerator' as const, label: `Continued (${dataset.summary.numerator})` },
              { key: 'failed' as const, label: `Did Not Continue (${(dataset.summary.denominator! - dataset.summary.numerator!)})` },
            ].map(t => (
              <button
                key={t.key}
                className={`px-2.5 py-1 rounded text-[10px] border transition-colors ${
                  tabFilter === t.key
                    ? 'bg-secondary text-secondary-foreground border-secondary'
                    : 'bg-card text-muted-foreground border-border hover:bg-accent/50'
                }`}
                onClick={() => { onTabChange(t.key); setPage(0); }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="rounded border overflow-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Patient</TableHead>
                <TableHead className="text-[10px]">Provider</TableHead>
                <TableHead className="text-[10px]">Date</TableHead>
                <TableHead className="text-[10px]">Visit Type / Stages</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                {dataset.mode !== 'patient' && <TableHead className="text-[10px]">Role</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row, i) => (
                <TableRow
                  key={i}
                  className={row.isEvidence ? '' : 'opacity-50'}
                >
                  <TableCell className="text-[10px] max-w-[120px] truncate font-medium">{row.patientName}</TableCell>
                  <TableCell className="text-[10px]">{row.provider}</TableCell>
                  <TableCell className="text-[10px] whitespace-nowrap">{row.date}</TableCell>
                  <TableCell className="text-[10px] max-w-[150px] truncate">{row.visitType}</TableCell>
                  <TableCell className="text-[10px]">{row.status}</TableCell>
                  {dataset.mode !== 'patient' && (
                    <TableCell className="text-[10px]">
                      {row.isEvidence ? (
                        <Badge variant="outline" className="text-[8px] bg-secondary/10">Evidence</Badge>
                      ) : (
                        <span className="text-faint">Context</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {paginatedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                    No rows match the current filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 text-[10px]">
              <ChevronLeft className="h-3 w-3 mr-0.5" /> Prev
            </Button>
            <span className="text-[10px] text-muted-foreground">Page {page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 text-[10px]">
              Next <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
