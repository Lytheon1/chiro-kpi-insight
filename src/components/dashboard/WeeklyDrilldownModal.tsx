import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { containsAny, normalizeText } from '@/lib/utils/normalize';
import type { EndOfDayAppointmentRow, CmrRow, DashboardFilters } from '@/types/reports';

interface WeeklyDrilldownModalProps {
  open: boolean;
  onClose: () => void;
  weekLabel: string;
  rows: EndOfDayAppointmentRow[];
  cmrRows: CmrRow[];
  filters: DashboardFilters;
}

type ModalTab = 'all' | 'canceled' | 'noshow' | 'rescheduled' | 'needsreview';

export const WeeklyDrilldownModal = ({
  open, onClose, weekLabel, rows, cmrRows, filters,
}: WeeklyDrilldownModalProps) => {
  const [tab, setTab] = useState<ModalTab>('all');

  // Compute summary from passed rows
  const kept = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.completedKeywords)).length;
  const canceled = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.canceledKeywords)).length;
  const noShow = rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.noShowKeywords)).length;
  const rescheduled = cmrRows.filter(r => containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)).length;

  const rofScheduled = rows.filter(r => {
    const p = normalizeText(r.purposeRaw);
    const s = normalizeText(r.statusRaw);
    return containsAny(p, filters.rofKeywords) && (
      containsAny(s, filters.completedKeywords) || containsAny(s, filters.canceledKeywords) || containsAny(s, filters.noShowKeywords)
    );
  }).length;
  const rofCompleted = rows.filter(r =>
    containsAny(normalizeText(r.purposeRaw), filters.rofKeywords) &&
    containsAny(normalizeText(r.statusRaw), filters.completedKeywords)
  ).length;

  const scheduledDenom = kept + canceled + noShow;
  const retentionRate = scheduledDenom > 0 ? (kept / scheduledDenom * 100).toFixed(1) : '0.0';

  // Provider breakdown
  const providerMap = new Map<string, { kept: number; canceled: number; noShow: number; rescheduled: number }>();
  for (const r of rows) {
    const p = r.provider || 'Unknown';
    if (!providerMap.has(p)) providerMap.set(p, { kept: 0, canceled: 0, noShow: 0, rescheduled: 0 });
    const s = normalizeText(r.statusRaw);
    if (containsAny(s, filters.completedKeywords)) providerMap.get(p)!.kept++;
    if (containsAny(s, filters.canceledKeywords)) providerMap.get(p)!.canceled++;
    if (containsAny(s, filters.noShowKeywords)) providerMap.get(p)!.noShow++;
  }
  for (const r of cmrRows) {
    const p = r.provider || 'Unknown';
    if (!providerMap.has(p)) providerMap.set(p, { kept: 0, canceled: 0, noShow: 0, rescheduled: 0 });
    if (containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords)) providerMap.get(p)!.rescheduled++;
  }

  // Cancel reasons from CMR
  const cancelReasons = new Map<string, number>();
  const rescheduleReasons = new Map<string, number>();
  for (const r of cmrRows) {
    const s = normalizeText(r.statusRaw);
    const reason = r.reasonRaw?.trim() || 'Unspecified';
    if (containsAny(s, filters.canceledKeywords)) cancelReasons.set(reason, (cancelReasons.get(reason) ?? 0) + 1);
    if (containsAny(s, filters.rescheduledKeywords)) rescheduleReasons.set(reason, (rescheduleReasons.get(reason) ?? 0) + 1);
  }
  const topCancelReasons = Array.from(cancelReasons.entries()).sort(([,a],[,b]) => b - a).slice(0, 5);
  const topRescheduleReasons = Array.from(rescheduleReasons.entries()).sort(([,a],[,b]) => b - a).slice(0, 5);

  // Filter patient list rows
  const filteredRows = (() => {
    switch (tab) {
      case 'canceled': return rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.canceledKeywords));
      case 'noshow': return rows.filter(r => containsAny(normalizeText(r.statusRaw), filters.noShowKeywords));
      case 'rescheduled': return cmrRows.map(r => ({
        ...r, provider: r.provider || '', purposeRaw: r.apptTypeRaw,
      })).filter(r => containsAny(normalizeText(r.statusRaw), filters.rescheduledKeywords));
      default: return rows;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Week: {weekLabel}</DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Kept', value: kept, color: 'text-success' },
            { label: 'Canceled', value: canceled, color: 'text-destructive' },
            { label: 'No-Show', value: noShow, color: 'text-warning' },
            { label: 'Rescheduled', value: rescheduled, color: 'text-primary' },
            { label: 'ROF Sched', value: rofScheduled },
            { label: 'ROF Kept', value: rofCompleted },
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-md bg-muted/50">
              <div className={`text-xl font-bold ${s.color || ''}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">Retention: <span className="font-medium text-foreground">{retentionRate}%</span></div>

        {/* Provider breakdown */}
        <div className="rounded border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Kept</TableHead>
                <TableHead className="text-right">Canceled</TableHead>
                <TableHead className="text-right">No-Show</TableHead>
                <TableHead className="text-right">Rescheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(providerMap.entries()).map(([prov, d]) => (
                <TableRow key={prov}>
                  <TableCell className="text-xs font-medium">{prov}</TableCell>
                  <TableCell className="text-xs text-right">{d.kept}</TableCell>
                  <TableCell className="text-xs text-right">{d.canceled}</TableCell>
                  <TableCell className="text-xs text-right">{d.noShow}</TableCell>
                  <TableCell className="text-xs text-right">{d.rescheduled}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Reasons */}
        <div className="grid gap-4 sm:grid-cols-2">
          {topCancelReasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Top Cancel Reasons</h4>
              <div className="space-y-1">
                {topCancelReasons.map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-xs">
                    <span className="truncate max-w-[200px]">{reason}</span>
                    <Badge variant="outline" className="text-[10px]">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topRescheduleReasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Top Reschedule Reasons</h4>
              <div className="space-y-1">
                {topRescheduleReasons.map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-xs">
                    <span className="truncate max-w-[200px]">{reason}</span>
                    <Badge variant="outline" className="text-[10px]">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Patient rows */}
        <div className="space-y-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ModalTab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="canceled">Canceled</TabsTrigger>
              <TabsTrigger value="noshow">No Show</TabsTrigger>
              <TabsTrigger value="rescheduled">Rescheduled</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="rounded border overflow-auto max-h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Visit Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.slice(0, 50).map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-xs">{r.patientName || '—'}</TableCell>
                    <TableCell className="text-xs">{r.provider}</TableCell>
                    <TableCell className="text-xs">{r.purposeRaw || r.apptTypeRaw || '—'}</TableCell>
                    <TableCell className="text-xs">{r.statusRaw}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
