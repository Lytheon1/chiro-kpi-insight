import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { ProviderCarePathMetrics, DashboardMetrics, ProviderDisruptionRow } from '@/types/reports';

interface ProviderComparisonTableProps {
  carePathMetrics: ProviderCarePathMetrics[];
  disruptions: ProviderDisruptionRow[];
  metrics: DashboardMetrics;
}

type SortKey = 'provider' | 'newPts' | 'rofs' | 'npToRof' | 'rofToActive' | 'rofSc' | 'rofLtc' |
  'careScore' | 'kept' | 'retention' | 'canceled' | 'noShow' | 'rescheduled' | 'disruptionRate';

const scoreGradient = (score: number): string => {
  if (score >= 75) return 'bg-success/15';
  if (score >= 50) return 'bg-success/8';
  if (score >= 30) return 'bg-warning/10';
  return 'bg-destructive/8';
};

export const ProviderComparisonTable = ({
  carePathMetrics, disruptions, metrics,
}: ProviderComparisonTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('careScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Merge data by provider
  const disruptionMap = new Map(disruptions.map(d => [d.provider, d]));

  const rows = carePathMetrics.map(cp => {
    const dp = disruptionMap.get(cp.provider);
    return {
      provider: cp.provider,
      newPts: cp.newPatientCount,
      rofs: cp.rofCount,
      npToRof: cp.npToRofConversionRate,
      rofToActive: cp.rofToActiveTreatmentRate,
      rofSc: cp.directToScCount,
      rofLtc: cp.directToLtcCount,
      careScore: cp.carePathIntegrityScore,
      kept: dp ? dp.scheduledDenom - dp.canceled - dp.noShow : 0,
      retention: dp && dp.scheduledDenom > 0
        ? (dp.scheduledDenom - dp.canceled - dp.noShow) / dp.scheduledDenom
        : 0,
      canceled: dp?.canceled ?? 0,
      noShow: dp?.noShow ?? 0,
      rescheduled: dp?.rescheduled ?? 0,
      disruptionRate: dp?.disruptionRate ?? 0,
    };
  });

  const sortedRows = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string') {
      return sortDir === 'asc' ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const SortableHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none text-right whitespace-nowrap" onClick={() => handleSort(k)}>
      {children}{sortArrow(k)}
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Provider Comparison
          <Tooltip>
            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-sm">
              Care Path Integrity highlights whether patients tend to move through the expected
              visit sequence after ROF. Scores are directional operational patterns, not clinical judgments.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('provider')}>
                  Provider{sortArrow('provider')}
                </TableHead>
                <SortableHead k="newPts">New Pts</SortableHead>
                <SortableHead k="rofs">ROFs</SortableHead>
                <SortableHead k="npToRof">NP→ROF %</SortableHead>
                <SortableHead k="rofToActive">ROF→Tx %</SortableHead>
                <SortableHead k="rofSc">→SC</SortableHead>
                <SortableHead k="rofLtc">→LTC</SortableHead>
                <SortableHead k="careScore">Score</SortableHead>
                <SortableHead k="kept">Kept</SortableHead>
                <SortableHead k="retention">Ret %</SortableHead>
                <SortableHead k="canceled">Cancel</SortableHead>
                <SortableHead k="noShow">No-Show</SortableHead>
                <SortableHead k="rescheduled">Resch</SortableHead>
                <SortableHead k="disruptionRate">Disrupt %</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map(r => (
                <TableRow key={r.provider}>
                  <TableCell className="text-xs font-medium">{r.provider}</TableCell>
                  <TableCell className="text-xs text-right">{r.newPts}</TableCell>
                  <TableCell className="text-xs text-right">{r.rofs}</TableCell>
                  <TableCell className="text-xs text-right">{(r.npToRof * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-xs text-right">{(r.rofToActive * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-xs text-right">{r.rofSc}</TableCell>
                  <TableCell className="text-xs text-right">{r.rofLtc}</TableCell>
                  <TableCell className={`text-xs text-right font-bold ${scoreGradient(r.careScore)} rounded`}>
                    {r.careScore}
                  </TableCell>
                  <TableCell className="text-xs text-right">{r.kept}</TableCell>
                  <TableCell className="text-xs text-right">{(r.retention * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-right">{r.canceled}</TableCell>
                  <TableCell className="text-xs text-right">{r.noShow}</TableCell>
                  <TableCell className="text-xs text-right">{r.rescheduled}</TableCell>
                  <TableCell className="text-xs text-right">{(r.disruptionRate * 100).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
