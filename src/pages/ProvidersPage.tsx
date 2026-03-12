import { useState } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { ProviderComparisonTable } from '@/components/dashboard/ProviderComparisonTable';
import { CarePathSection } from '@/components/dashboard/CarePathSection';
import { RescheduleInsights } from '@/components/dashboard/RescheduleInsights';

const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s;

const CustomTick = ({ x, y, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <title>{payload.value}</title>
    <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11}>
      {truncate(payload.value, 30)}
    </text>
  </g>
);

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export default function ProvidersPage() {
  const { metrics, carePathAnalysis, sequenceAnalysis } = useDashboard();

  if (!metrics || !carePathAnalysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available. Upload reports first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Comparison Table */}
      <ProviderComparisonTable
        carePathMetrics={carePathAnalysis.providerMetrics}
        disruptions={metrics.providerDisruptions}
        metrics={metrics}
      />

      {/* Care Path Detail */}
      <CarePathSection analysis={carePathAnalysis} />

      {/* NP Next Step Analysis */}
      {sequenceAnalysis && sequenceAnalysis.npNextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              What happens after a New Patient visit?
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  For each patient with a New Patient visit, this shows what their next chronological visit was.
                  ROF is the expected next step. Other paths are labeled as "unexpected" — not wrong, but worth reviewing.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              {sequenceAnalysis.totalNPPatients} patients with NP visits tracked.
              {sequenceAnalysis.unexpectedNextStepCount > 0 && (
                <span className="text-warning ml-2">
                  {sequenceAnalysis.unexpectedNextStepCount} ({(sequenceAnalysis.unexpectedNextStepPct * 100).toFixed(0)}%) had an unexpected next step.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={Math.max(200, sequenceAnalysis.npNextSteps.length * 36)}>
              <BarChart data={sequenceAnalysis.npNextSteps} layout="vertical" margin={{ left: 220, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="category" width={210} tick={<CustomTick />} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>

            <div className="rounded border overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sequenceAnalysis.npNextSteps.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{s.category}</TableCell>
                      <TableCell className="text-xs text-right">{s.count}</TableCell>
                      <TableCell className="text-xs text-right">
                        {sequenceAnalysis.totalNPPatients > 0
                          ? ((s.count / sequenceAnalysis.totalNPPatients) * 100).toFixed(1)
                          : '0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROF Next 2 Visits */}
      {sequenceAnalysis && sequenceAnalysis.rofPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Treatment start pattern after ROF
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  For each patient with an ROF visit, this shows the next 2 completed visits.
                  Canceled/no-show visits are noted as disruptions but skipped in the path.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              {sequenceAnalysis.totalROFPatients} patients with ROF visits tracked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={Math.max(200, sequenceAnalysis.rofPaths.length * 36)}>
              <BarChart data={sequenceAnalysis.rofPaths} layout="vertical" margin={{ left: 220, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="path" width={210} tick={<CustomTick />} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>

            {/* SC/LTC note */}
            <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border">
              Patients who moved from ROF into a maintenance-style visit without a visible active treatment
              phase may reflect a complete prior plan or an early maintenance transition — review manually.
            </div>

            <div className="rounded border overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sequenceAnalysis.rofPaths.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{p.path}</TableCell>
                      <TableCell className="text-xs text-right">{p.count}</TableCell>
                      <TableCell className="text-xs text-right">
                        {sequenceAnalysis.totalROFPatients > 0
                          ? ((p.count / sequenceAnalysis.totalROFPatients) * 100).toFixed(1)
                          : '0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disruption Summary */}
      <RescheduleInsights metrics={metrics} />
    </div>
  );
}
