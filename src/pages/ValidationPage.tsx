import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, Info, Bug, ChevronDown, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { useState } from 'react';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import type { ConfidenceLevel } from '@/lib/kpi/validateReport';

const confidenceConfig: Record<ConfidenceLevel, { label: string; icon: any; color: string; rec: string }> = {
  high: { label: 'High Confidence', icon: CheckCircle2, color: 'text-success', rec: 'Okay to use' },
  review: { label: 'Review Source Data', icon: Info, color: 'text-warning', rec: 'Use with caution' },
  low: { label: 'Do Not Rely On This Metric Yet', icon: AlertTriangle, color: 'text-destructive', rec: 'Do not use for provider scoring' },
};

export default function ValidationPage() {
  const { validationReport, endOfDay, cmr, activeFilters, carePathAnalysis } = useDashboard();
  const [debugOpen, setDebugOpen] = useState(false);

  if (!validationReport || !endOfDay || !cmr) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Upload reports to see validation.</CardContent></Card>;
  }

  const totalRows = endOfDay.appointments.length;
  const nameCount = endOfDay.appointments.filter(a => a.patientName).length;
  const namePct = totalRows > 0 ? ((nameCount / totalRows) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold tracking-tight">Metric Validation</h2>

      {/* Reconciliation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">Reconciliation Table</CardTitle>
          <CardDescription className="text-[10px]">Row-level parsed counts vs Report A daily totals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {validationReport.hasNewPatientDiscrepancy && (
            <div className="flex items-start gap-2 p-2.5 rounded bg-destructive/10 border border-destructive/20 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              New Patient totals do not reconcile. KPIs based on New Patient counts should be interpreted with caution.
            </div>
          )}
          <div className="rounded border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Metric</TableHead>
                  <TableHead className="text-[10px] text-right">Summary Total</TableHead>
                  <TableHead className="text-[10px] text-right">Parsed Rows</TableHead>
                  <TableHead className="text-[10px] text-right">Difference</TableHead>
                  <TableHead className="text-[10px] text-right">% Var</TableHead>
                  <TableHead className="text-[10px]">Confidence</TableHead>
                  <TableHead className="text-[10px]">Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validationReport.fields.map((f, i) => {
                  const cfg = confidenceConfig[f.confidence];
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-[10px] font-medium">{f.field}</TableCell>
                      <TableCell className="text-[10px] text-right">{f.totalsCount}</TableCell>
                      <TableCell className="text-[10px] text-right">{f.rowLevelCount}</TableCell>
                      <TableCell className="text-[10px] text-right">{f.difference > 0 ? '+' : ''}{f.difference}</TableCell>
                      <TableCell className="text-[10px] text-right">{f.pctDifference.toFixed(1)}%</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 text-[9px] ${cfg.color}`}>
                          <Icon className="h-3 w-3" />{cfg.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-[9px] text-muted-foreground">{f.recommendation}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Data Coverage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">Data Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="p-2.5 rounded border bg-muted/30">
              <div className="text-lg font-bold">{totalRows.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">Rows analyzed (Report A)</div>
            </div>
            <div className="p-2.5 rounded border bg-muted/30">
              <div className="text-lg font-bold">{namePct}%</div>
              <div className="text-[10px] text-muted-foreground">Patient name coverage</div>
            </div>
            <div className="p-2.5 rounded border bg-muted/30">
              <div className="text-lg font-bold">{endOfDay.providers.length}</div>
              <div className="text-[10px] text-muted-foreground">Providers detected</div>
            </div>
            <div className="p-2.5 rounded border bg-muted/30">
              <div className="text-lg font-bold font-mono">{endOfDay.minDate} — {endOfDay.maxDate}</div>
              <div className="text-[10px] text-muted-foreground">Date range</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mismatches */}
      {validationReport.mismatches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold">Report Mismatch Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {validationReport.mismatches.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
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
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <Bug className="h-3.5 w-3.5 text-muted-foreground" />
                  <CardTitle className="text-xs font-semibold">Parser Diagnostics</CardTitle>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 text-xs">
                  <h4 className="font-semibold text-[11px]">Report A — End-of-Day</h4>
                  <p>Appointment rows: <Badge variant="outline" className="text-[9px]">{endOfDay.appointments.length}</Badge></p>
                  <p>Daily totals rows: <Badge variant="outline" className="text-[9px]">{endOfDay.dailyTotals.length}</Badge></p>
                  <p>Providers: <Badge variant="outline" className="text-[9px]">{endOfDay.providers.join(', ') || 'None'}</Badge></p>
                  <p>Names captured: <Badge variant="outline" className="text-[9px]">{nameCount}/{totalRows} ({namePct}%)</Badge></p>
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-semibold text-[11px]">Report B — Canceled/Missed/Rescheduled</h4>
                  <p>Event rows: <Badge variant="outline" className="text-[9px]">{cmr.rows.length}</Badge></p>
                  <p>Providers: <Badge variant="outline" className="text-[9px]">{cmr.providers.join(', ') || 'None'}</Badge></p>
                  <p>Names captured: <Badge variant="outline" className="text-[9px]">
                    {cmr.rows.filter(r => r.patientName).length}/{cmr.rows.length}
                  </Badge></p>
                </div>
              </div>

              {/* Active keywords */}
              <div>
                <h4 className="font-semibold text-[11px] mb-1">Active Keywords</h4>
                <div className="grid gap-1.5 md:grid-cols-3 text-[10px]">
                  {[
                    ['Completed', activeFilters.completedKeywords],
                    ['Canceled', activeFilters.canceledKeywords],
                    ['No Show', activeFilters.noShowKeywords],
                    ['Rescheduled', activeFilters.rescheduledKeywords],
                    ['ROF', activeFilters.rofKeywords],
                    ['New Patient', activeFilters.newPatientKeywords],
                    ['Return Visit', activeFilters.returnVisitKeywords],
                    ['Traction', activeFilters.tractionKeywords || []],
                    ['Therapy', activeFilters.therapyKeywords || []],
                    ['SC', activeFilters.supportiveCareKeywords],
                    ['LTC', activeFilters.ltcKeywords],
                    ['Massage', activeFilters.massageKeywords],
                  ].map(([label, kws]) => (
                    <div key={label as string}><span className="font-medium">{label as string}:</span> {(kws as string[]).join(', ')}</div>
                  ))}
                </div>
              </div>

              {carePathAnalysis && (
                <div className="text-[10px] text-muted-foreground">
                  Care Path: {carePathAnalysis.journeys.length} journeys. Missing name rate: {carePathAnalysis.missingNamePercentage.toFixed(1)}%.
                  Analysis {carePathAnalysis.isPathAnalysisReliable ? 'reliable' : 'limited'}.
                </div>
              )}

              {/* Sample rows */}
              <div>
                <h4 className="font-semibold text-[11px] mb-1">Report A — First 5 Rows</h4>
                <div className="rounded border overflow-auto max-h-36">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[9px]">Date</TableHead>
                        <TableHead className="text-[9px]">Patient</TableHead>
                        <TableHead className="text-[9px]">Provider</TableHead>
                        <TableHead className="text-[9px]">Status</TableHead>
                        <TableHead className="text-[9px]">Purpose</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {endOfDay.appointments.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[9px]">{row.date}</TableCell>
                          <TableCell className="text-[9px]">{row.patientName || '—'}</TableCell>
                          <TableCell className="text-[9px]">{row.provider}</TableCell>
                          <TableCell className="text-[9px]">{row.statusRaw}</TableCell>
                          <TableCell className="text-[9px]">{row.purposeRaw}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
