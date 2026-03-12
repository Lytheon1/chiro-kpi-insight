import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { getProviderColor } from '@/lib/utils/providerColors';
import type { DashboardMetrics } from '@/types/reports';

interface RescheduleInsightsProps {
  metrics: DashboardMetrics;
  singleProvider?: boolean;
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

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export const RescheduleInsights = ({ metrics, singleProvider = false }: RescheduleInsightsProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Reschedule & Disruption Summary
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] text-xs space-y-3" side="right">
                <h4 className="font-semibold text-sm">About Reschedule & Disruption Indicators</h4>
                <p>These cards count <strong>unique patients</strong>, not appointment events.</p>
                <p>
                  <strong>Repeat-Rescheduled Patients:</strong> patients who rescheduled 2 or more
                  times during the selected period. High repeat-reschedule counts can
                  indicate scheduling friction or barriers to consistent care.
                </p>
                <p>
                  <strong>Disruption-Heavy Patients:</strong> patients with 2 or more total disruption
                  events, including any combination of canceled, rescheduled, or
                  no-show appointments. These patients may benefit from proactive
                  outreach or scheduling support.
                </p>
                <p className="text-muted-foreground italic">
                  These are operational signals — not clinical judgments. Click either
                  card to review the affected patient list.
                </p>
              </PopoverContent>
            </Popover>
          </CardTitle>
          <CardDescription className="text-xs">
            Rescheduled visits are tracked separately as an operational signal. They do not change
            the retention rate, but can indicate scheduling friction or provider-specific patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Count cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className="p-4 rounded-md bg-muted/50 border cursor-pointer hover:bg-accent/30 transition-colors group"
              onClick={() => navigate('/patients?filter=repeat_reschedule')}
            >
              <div className="text-2xl font-bold">{metrics.repeatRescheduledPatients}</div>
              <div className="text-sm font-medium text-muted-foreground">Repeat-Rescheduled Patients</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {metrics.repeatRescheduledPatients} unique patients with 2 or more rescheduled appointments
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                Each person listed rescheduled at least twice this quarter
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                across {metrics.rescheduledCount} reschedule events total
              </div>
              <div className="text-[10px] text-primary mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View patients <ArrowRight className="h-2.5 w-2.5" />
              </div>
            </div>
            <div
              className="p-4 rounded-md bg-muted/50 border cursor-pointer hover:bg-accent/30 transition-colors group"
              onClick={() => navigate('/patients?filter=disruption_heavy')}
            >
              <div className="text-2xl font-bold">{metrics.disruptionHeavyPatients}</div>
              <div className="text-sm font-medium text-muted-foreground">Disruption-Heavy Patients</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {metrics.disruptionHeavyPatients} unique patients with 2 or more disruption events
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                Disruption = any canceled, rescheduled, or no-show appointment
              </div>
              <div className="text-[10px] text-primary mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View patients <ArrowRight className="h-2.5 w-2.5" />
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className={`grid gap-6 ${singleProvider ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {metrics.rescheduledByProvider.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Rescheduled by Provider</h4>
                {singleProvider ? (
                  <div className="p-4 rounded-md bg-muted/50 border">
                    <div className="text-2xl font-bold">{metrics.rescheduledByProvider[0]?.count ?? 0}</div>
                    <div className="text-sm text-muted-foreground">
                      Total rescheduled — {metrics.rescheduledByProvider[0]?.provider}
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(150, metrics.rescheduledByProvider.length * 32)}>
                    <BarChart data={metrics.rescheduledByProvider} layout="vertical" margin={{ left: 120, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" className="text-xs" />
                      <YAxis type="category" dataKey="provider" width={110} tick={{ fontSize: 11 }} />
                      <RechartsTooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Rescheduled">
                        {metrics.rescheduledByProvider.map((entry, i) => (
                          <Cell key={i} fill={getProviderColor(entry.provider)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {metrics.rescheduledByApptType.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Rescheduled by Appointment Type</h4>
                <ResponsiveContainer width="100%" height={Math.max(150, metrics.rescheduledByApptType.slice(0, 10).length * 32)}>
                  <BarChart data={metrics.rescheduledByApptType.slice(0, 10)} layout="vertical" margin={{ left: 150, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="type" width={140} tick={<CustomTick />} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="Rescheduled" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Provider Disruption Summary */}
          {metrics.providerDisruptions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                {singleProvider ? 'Disruption Summary' : 'Provider Disruption Summary'}
              </h4>
              <div className="rounded border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!singleProvider && <TableHead>Provider</TableHead>}
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
                        {!singleProvider && <TableCell className="text-xs font-medium">{d.provider}</TableCell>}
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
