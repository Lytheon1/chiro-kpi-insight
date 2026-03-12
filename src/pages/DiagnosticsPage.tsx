import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, Info, Bug, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ConfidenceLevel } from '@/lib/kpi/validateReport';

const confidenceConfig: Record<ConfidenceLevel, { label: string; icon: any; color: string }> = {
  high: { label: 'High Confidence', icon: CheckCircle2, color: 'text-success' },
  review: { label: 'Review Source Data', icon: Info, color: 'text-warning' },
  low: { label: 'Do Not Rely On This Metric Yet', icon: AlertTriangle, color: 'text-destructive' },
};

export default function DiagnosticsPage() {
  const { validationReport, endOfDay, cmr, activeFilters, carePathAnalysis } = useDashboard();
  const [debugOpen, setDebugOpen] = useState(false);

  if (!validationReport || !endOfDay || !cmr) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Upload reports to see validation diagnostics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Data Confidence & Parser Diagnostics</h2>

      {/* Validation Report */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Report</CardTitle>
          <CardDescription>
            Comparing row-level parsed counts against Report A daily totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {validationReport.hasNewPatientDiscrepancy && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>
                New Patient totals in this report do not reconcile between the summary section
                and individual appointment rows. KPIs based on New Patient counts should be
                interpreted with caution.
              </span>
            </div>
          )}

          <div className="rounded border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead className="text-right">Row-Level</TableHead>
                  <TableHead className="text-right">Totals</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-right">% Diff</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validationReport.fields.map((f, i) => {
                  const cfg = confidenceConfig[f.confidence];
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{f.field}</TableCell>
                      <TableCell className="text-sm text-right">{f.rowLevelCount}</TableCell>
                      <TableCell className="text-sm text-right">{f.totalsCount}</TableCell>
                      <TableCell className="text-sm text-right">{f.difference > 0 ? '+' : ''}{f.difference}</TableCell>
                      <TableCell className="text-sm text-right">{f.pctDifference.toFixed(1)}%</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.recommendation}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Report Mismatches */}
      {validationReport.mismatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Mismatch Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validationReport.mismatches.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <span>{m.detail}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parser Diagnostics */}
      <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Parser Diagnostics</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Report A — End-of-Day</h4>
                  <div className="text-sm space-y-1">
                    <p>Appointment rows: <Badge variant="outline">{endOfDay.appointments.length}</Badge></p>
                    <p>Daily totals rows: <Badge variant="outline">{endOfDay.dailyTotals.length}</Badge></p>
                    <p>Providers: <Badge variant="outline">{endOfDay.providers.join(', ') || 'None'}</Badge></p>
                    <p>Date range: <Badge variant="outline">{endOfDay.minDate ?? '?'} → {endOfDay.maxDate ?? '?'}</Badge></p>
                    <p>Rows with patient names: <Badge variant="outline">
                      {endOfDay.appointments.filter(a => a.patientName).length} / {endOfDay.appointments.length}
                      {' '}({endOfDay.appointments.length > 0
                        ? ((endOfDay.appointments.filter(a => a.patientName).length / endOfDay.appointments.length) * 100).toFixed(0)
                        : 0}%)
                    </Badge></p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Report B — Canceled/Missed/Rescheduled</h4>
                  <div className="text-sm space-y-1">
                    <p>Event rows (deduped): <Badge variant="outline">{cmr.rows.length}</Badge></p>
                    <p>Providers: <Badge variant="outline">{cmr.providers.join(', ') || 'None'}</Badge></p>
                    <p>Date range: <Badge variant="outline">{cmr.minDate ?? '?'} → {cmr.maxDate ?? '?'}</Badge></p>
                    <p>Rows with patient names: <Badge variant="outline">
                      {cmr.rows.filter(r => r.patientName).length} / {cmr.rows.length}
                      {' '}({cmr.rows.length > 0
                        ? ((cmr.rows.filter(r => r.patientName).length / cmr.rows.length) * 100).toFixed(0)
                        : 0}%)
                    </Badge></p>
                  </div>
                </div>
              </div>

              {/* Sample rows */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Report A — First 5 Rows</h4>
                <div className="rounded border overflow-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Purpose</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {endOfDay.appointments.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-xs">{row.patientName || '—'}</TableCell>
                          <TableCell className="text-xs">{row.provider}</TableCell>
                          <TableCell className="text-xs">{row.statusRaw}</TableCell>
                          <TableCell className="text-xs">{row.purposeRaw}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Report B — First 5 Rows</h4>
                <div className="rounded border overflow-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cmr.rows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-xs">{row.patientName || '—'}</TableCell>
                          <TableCell className="text-xs">{row.provider ?? ''}</TableCell>
                          <TableCell className="text-xs">{row.statusRaw}</TableCell>
                          <TableCell className="text-xs">{row.reasonRaw ?? ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Active Keyword Settings</h4>
                <div className="grid gap-2 md:grid-cols-3 text-xs">
                  <div><span className="font-medium">Completed:</span> {activeFilters.completedKeywords.join(', ')}</div>
                  <div><span className="font-medium">Canceled:</span> {activeFilters.canceledKeywords.join(', ')}</div>
                  <div><span className="font-medium">No Show:</span> {activeFilters.noShowKeywords.join(', ')}</div>
                  <div><span className="font-medium">Rescheduled:</span> {activeFilters.rescheduledKeywords.join(', ')}</div>
                  <div><span className="font-medium">ROF:</span> {activeFilters.rofKeywords.join(', ')}</div>
                  <div><span className="font-medium">Massage:</span> {activeFilters.massageKeywords.join(', ')}</div>
                  <div><span className="font-medium">New Patient:</span> {activeFilters.newPatientKeywords.join(', ')}</div>
                  <div><span className="font-medium">Return Visit:</span> {activeFilters.returnVisitKeywords.join(', ')}</div>
                  <div><span className="font-medium">SC:</span> {activeFilters.supportiveCareKeywords.join(', ')}</div>
                  <div><span className="font-medium">LTC:</span> {activeFilters.ltcKeywords.join(', ')}</div>
                  <div><span className="font-medium">Traction:</span> {(activeFilters.tractionKeywords || []).join(', ')}</div>
                  <div><span className="font-medium">Therapy:</span> {(activeFilters.therapyKeywords || []).join(', ')}</div>
                </div>
              </div>

              {carePathAnalysis && (
                <div className="text-xs text-muted-foreground">
                  <strong>Care Path:</strong> {carePathAnalysis.journeys.length} patient journeys tracked.
                  Missing name rate: {carePathAnalysis.missingNamePercentage.toFixed(1)}%.
                  Path analysis {carePathAnalysis.isPathAnalysisReliable ? 'is reliable' : 'has limited reliability'}.
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
