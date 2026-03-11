import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Bug } from 'lucide-react';
import { useState } from 'react';
import type { ParsedEndOfDay, ParsedCMR, DashboardFilters } from '@/types/reports';

interface DebugParserPanelProps {
  endOfDay: ParsedEndOfDay;
  cmr: ParsedCMR;
  filters: DashboardFilters;
}

export const DebugParserPanel = ({ endOfDay, cmr, filters }: DebugParserPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Parser Diagnostics</CardTitle>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Report A — End-of-Day</h4>
                <div className="text-sm space-y-1">
                  <p>Appointment rows: <Badge variant="outline">{endOfDay.appointments.length}</Badge></p>
                  <p>Daily totals rows: <Badge variant="outline">{endOfDay.dailyTotals.length}</Badge></p>
                  <p>Providers: <Badge variant="outline">{endOfDay.providers.join(', ') || 'None'}</Badge></p>
                  <p>Date range: <Badge variant="outline">{endOfDay.minDate ?? '?'} → {endOfDay.maxDate ?? '?'}</Badge></p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Report B — Canceled/Missed/Rescheduled</h4>
                <div className="text-sm space-y-1">
                  <p>Event rows (deduped): <Badge variant="outline">{cmr.rows.length}</Badge></p>
                  <p>Providers: <Badge variant="outline">{cmr.providers.join(', ') || 'None'}</Badge></p>
                  <p>Date range: <Badge variant="outline">{cmr.minDate ?? '?'} → {cmr.maxDate ?? '?'}</Badge></p>
                </div>
              </div>
            </div>

            {/* Report A Sample */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Report A — First 10 Rows</h4>
              <div className="rounded border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Purpose</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endOfDay.appointments.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{row.date}</TableCell>
                        <TableCell className="text-xs">{row.provider}</TableCell>
                        <TableCell className="text-xs">{row.statusRaw}</TableCell>
                        <TableCell className="text-xs">{row.purposeRaw}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Report B Sample */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Report B — First 10 Rows</h4>
              <div className="rounded border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmr.rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{row.date}</TableCell>
                        <TableCell className="text-xs">{row.provider ?? ''}</TableCell>
                        <TableCell className="text-xs">{row.statusRaw}</TableCell>
                        <TableCell className="text-xs">{row.reasonRaw ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Active Keywords */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Active Keyword Settings</h4>
              <div className="grid gap-2 md:grid-cols-3 text-xs">
                <div><span className="font-medium">Completed:</span> {filters.completedKeywords.join(', ')}</div>
                <div><span className="font-medium">Canceled:</span> {filters.canceledKeywords.join(', ')}</div>
                <div><span className="font-medium">No Show:</span> {filters.noShowKeywords.join(', ')}</div>
                <div><span className="font-medium">Rescheduled:</span> {filters.rescheduledKeywords.join(', ')}</div>
                <div><span className="font-medium">ROF:</span> {filters.rofKeywords.join(', ')}</div>
                <div><span className="font-medium">Massage:</span> {filters.massageKeywords.join(', ')}</div>
                {filters.excludedPurposeKeywords && filters.excludedPurposeKeywords.length > 0 && (
                  <div className="md:col-span-3"><span className="font-medium">Excluded Purposes:</span> {filters.excludedPurposeKeywords.join(', ')}</div>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
