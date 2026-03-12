import { useState, useMemo } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { METRIC_KEYS } from '@/types/evidence';
import type { MetricWithEvidence } from '@/types/evidence';
import { Search, FileText } from 'lucide-react';

const metricLabels: Record<string, string> = {
  [METRIC_KEYS.ROF_COMPLETION_RATE]: 'ROF Completion Rate',
  [METRIC_KEYS.RETENTION_RATE]: 'Retention Rate',
  [METRIC_KEYS.TOTAL_KEPT]: 'Total Kept (ex-massage)',
  [METRIC_KEYS.RESCHEDULED_COUNT]: 'Rescheduled Count',
  [METRIC_KEYS.NEW_PATIENTS]: 'New Patients',
  [METRIC_KEYS.CURRENT_PATIENTS]: 'Current Patients',
};

export default function EvidencePage() {
  const { evidenceStore, endOfDay, cmr, metrics } = useDashboard();
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState('');

  const metricKeys = Object.keys(evidenceStore);
  const selected = selectedMetric ? evidenceStore[selectedMetric] : null;

  // Patient lineage search
  const matchingRows = useMemo(() => {
    if (!patientSearch.trim() || !endOfDay) return [];
    const q = patientSearch.toLowerCase();
    return endOfDay.appointments.filter(a =>
      a.patientName?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [patientSearch, endOfDay]);

  const matchingCmrRows = useMemo(() => {
    if (!patientSearch.trim() || !cmr) return [];
    const q = patientSearch.toLowerCase();
    return cmr.rows.filter(r =>
      r.patientName?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [patientSearch, cmr]);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold tracking-tight">Evidence & Data Lineage</h2>

      {/* Metric Explorer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">Metric Explorer</CardTitle>
          <CardDescription className="text-[10px]">Select a metric to view its formula, source data, and supporting rows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="h-8 text-xs w-[280px]"><SelectValue placeholder="Select metric..." /></SelectTrigger>
            <SelectContent>
              {metricKeys.map(k => (
                <SelectItem key={k} value={k} className="text-xs">{metricLabels[k] || k}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold">
                  {typeof selected.value === 'number' && selected.value < 1 && selected.value > 0
                    ? `${(selected.value * 100).toFixed(1)}%`
                    : selected.value}
                </div>
                <ConfidenceBadge evidence={selected} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="p-2 rounded border bg-muted/30">
                  <span className="font-medium">Formula:</span> {selected.formula}
                </div>
                <div className="p-2 rounded border bg-muted/30">
                  <span className="font-medium">Source:</span> Report {selected.sourceReports.join(' + ')} •
                  <span className="ml-1">Scope: {selected.scope.replace(/_/g, ' ')}</span>
                </div>
              </div>
              {selected.confidenceNote && (
                <div className="text-[10px] text-muted-foreground p-2 rounded bg-warning/10 border border-warning/20">
                  {selected.confidenceNote}
                </div>
              )}

              {/* Numerator rows */}
              {selected.numeratorRows.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold mb-1">Numerator Rows ({selected.numeratorRows.length})</h4>
                  <div className="rounded border overflow-auto max-h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px]">Date</TableHead>
                          <TableHead className="text-[9px]">Patient</TableHead>
                          <TableHead className="text-[9px]">Provider</TableHead>
                          <TableHead className="text-[9px]">Purpose</TableHead>
                          <TableHead className="text-[9px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.numeratorRows.slice(0, 50).map((r: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-[9px]">{r.date}</TableCell>
                            <TableCell className="text-[9px]">{r.patientName || '—'}</TableCell>
                            <TableCell className="text-[9px]">{r.provider}</TableCell>
                            <TableCell className="text-[9px]">{r.purposeRaw || r.apptTypeRaw || ''}</TableCell>
                            <TableCell className="text-[9px]">{r.statusRaw}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {selected.numeratorRows.length > 50 && (
                    <div className="text-[9px] text-muted-foreground mt-1">Showing 50 of {selected.numeratorRows.length}</div>
                  )}
                </div>
              )}

              {/* Denominator rows */}
              {selected.denominatorRows.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold mb-1">Denominator Rows ({selected.denominatorRows.length})</h4>
                  <div className="rounded border overflow-auto max-h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px]">Date</TableHead>
                          <TableHead className="text-[9px]">Patient</TableHead>
                          <TableHead className="text-[9px]">Provider</TableHead>
                          <TableHead className="text-[9px]">Purpose</TableHead>
                          <TableHead className="text-[9px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.denominatorRows.slice(0, 50).map((r: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-[9px]">{r.date}</TableCell>
                            <TableCell className="text-[9px]">{r.patientName || '—'}</TableCell>
                            <TableCell className="text-[9px]">{r.provider}</TableCell>
                            <TableCell className="text-[9px]">{r.purposeRaw || r.apptTypeRaw || ''}</TableCell>
                            <TableCell className="text-[9px]">{r.statusRaw}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {selected.denominatorRows.length > 50 && (
                    <div className="text-[9px] text-muted-foreground mt-1">Showing 50 of {selected.denominatorRows.length}</div>
                  )}
                </div>
              )}

              {/* Empty evidence warning */}
              {selected.numeratorRows.length === 0 && selected.denominatorRows.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 rounded border bg-muted/30">
                  Supporting evidence incomplete for this metric — verify source data on Validation page.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Lineage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">Patient Lineage</CardTitle>
          <CardDescription className="text-[10px]">Search by patient name to see all report rows and metrics they contribute to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search patient name..."
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {patientSearch.trim() && (
            <div className="space-y-3">
              {matchingRows.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold mb-1">Report A Rows ({matchingRows.length})</h4>
                  <div className="rounded border overflow-auto max-h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px]">Date</TableHead>
                          <TableHead className="text-[9px]">Patient</TableHead>
                          <TableHead className="text-[9px]">Provider</TableHead>
                          <TableHead className="text-[9px]">Purpose</TableHead>
                          <TableHead className="text-[9px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchingRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[9px]">{r.date}</TableCell>
                            <TableCell className="text-[9px]">{r.patientName}</TableCell>
                            <TableCell className="text-[9px]">{r.provider}</TableCell>
                            <TableCell className="text-[9px]">{r.purposeRaw}</TableCell>
                            <TableCell className="text-[9px]">{r.statusRaw}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {matchingCmrRows.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold mb-1">Report B Rows ({matchingCmrRows.length})</h4>
                  <div className="rounded border overflow-auto max-h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px]">Date</TableHead>
                          <TableHead className="text-[9px]">Patient</TableHead>
                          <TableHead className="text-[9px]">Provider</TableHead>
                          <TableHead className="text-[9px]">Type</TableHead>
                          <TableHead className="text-[9px]">Status</TableHead>
                          <TableHead className="text-[9px]">Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchingCmrRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[9px]">{r.date}</TableCell>
                            <TableCell className="text-[9px]">{r.patientName}</TableCell>
                            <TableCell className="text-[9px]">{r.provider}</TableCell>
                            <TableCell className="text-[9px]">{r.apptTypeRaw}</TableCell>
                            <TableCell className="text-[9px]">{r.statusRaw}</TableCell>
                            <TableCell className="text-[9px]">{r.reasonRaw}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {matchingRows.length === 0 && matchingCmrRows.length === 0 && (
                <div className="text-xs text-muted-foreground">No rows found for "{patientSearch}"</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data lineage summary */}
      <Card>
        <CardContent className="py-3 px-4 flex items-center gap-3 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>
            2 reports loaded •
            {endOfDay?.appointments.length.toLocaleString()} Report A rows •
            {cmr?.rows.length.toLocaleString()} Report B rows •
            {metricKeys.length} metrics with evidence
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
