import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Info, AlertCircle } from 'lucide-react';
import type { DashboardMetrics, ProviderDisruptionRow } from '@/types/reports';

interface RescheduleInsightsProps {
  metrics: DashboardMetrics;
}

const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s;

const CustomTick = ({ x, y, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <title>{payload.value}</title>
    <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11}>
      {truncate(payload.value, 30)}
    </text>
  </g>
);

export const RescheduleInsights = ({ metrics }: RescheduleInsightsProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Reschedule Insights
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Rescheduled visits are tracked separately as an operational signal. They do not change
                the retention rate above, but can indicate scheduling friction, patient instability,
                or provider-specific patterns.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            Rescheduled visits are tracked separately as an operational signal. They do not change
            the retention rate, but can indicate scheduling friction or provider-specific patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Count cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-md bg-muted/50 border">
              <div className="text-2xl font-bold">{metrics.repeatRescheduledPatients}</div>
              <div className="text-sm text-muted-foreground">Repeat-Rescheduled Patients</div>
              <div className="text-xs text-muted-foreground mt-1">Patients with 2+ reschedules in period</div>
            </div>
            <div className="p-4 rounded-md bg-muted/50 border">
              <div className="text-2xl font-bold">{metrics.disruptionHeavyPatients}</div>
              <div className="text-sm text-muted-foreground">Disruption-Heavy Patients</div>
              <div className="text-xs text-muted-foreground mt-1">Cancel + no-show + reschedule ≥ 2</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* By Provider */}
            {metrics.rescheduledByProvider.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Rescheduled by Provider</h4>
                <ResponsiveContainer width="100%" height={Math.max(150, metrics.rescheduledByProvider.length * 32)}>
                  <BarChart data={metrics.rescheduledByProvider} layout="vertical" margin={{ left: 120, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="provider" width={110} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Rescheduled" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* By Appointment Type */}
            {metrics.rescheduledByApptType.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Rescheduled by Appointment Type</h4>
                <ResponsiveContainer width="100%" height={Math.max(150, metrics.rescheduledByApptType.slice(0, 10).length * 32)}>
                  <BarChart data={metrics.rescheduledByApptType.slice(0, 10)} layout="vertical" margin={{ left: 150, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="type" width={140} tick={<CustomTick />} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="Rescheduled" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Provider Disruption Summary */}
          {metrics.providerDisruptions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Provider Disruption Summary</h4>
              <div className="rounded border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Canceled</TableHead>
                      <TableHead className="text-right">No-Show</TableHead>
                      <TableHead className="text-right">Rescheduled</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Disruption Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.providerDisruptions.map((d) => (
                      <TableRow key={d.provider}>
                        <TableCell className="text-xs font-medium">{d.provider}</TableCell>
                        <TableCell className="text-xs text-right">{d.canceled}</TableCell>
                        <TableCell className="text-xs text-right">{d.noShow}</TableCell>
                        <TableCell className="text-xs text-right">{d.rescheduled}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{d.totalDisruptions}</TableCell>
                        <TableCell className="text-xs text-right">
                          {(d.disruptionRate * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
