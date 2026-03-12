import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface ReasonBreakdownProps {
  topCancelReasons: Array<{ reason: string; count: number }>;
  topRescheduleReasons: Array<{ reason: string; count: number }>;
}

const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s;

const CustomTick = ({ x, y, payload }: any) => (
  <g transform={`translate(${x},${y})`}>
    <title>{payload.value}</title>
    <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11}>
      {truncate(payload.value, 35)}
    </text>
  </g>
);

const ReasonChart = ({
  data, title, description, color,
}: {
  data: Array<{ reason: string; count: number }>;
  title: string;
  description: string;
  color: string;
}) => {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 220, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" className="text-xs" />
            <YAxis
              type="category"
              dataKey="reason"
              width={210}
              tick={<CustomTick />}
            />
            <RechartsTooltip
              formatter={(value: number, name: string, props: any) => [
                `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                'Count',
              ]}
              labelFormatter={(label) => label}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} name="Count" />
          </BarChart>
        </ResponsiveContainer>

        {/* Data table */}
        <div className="rounded border overflow-auto max-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">
                    <Tooltip>
                      <TooltipTrigger className="text-left truncate max-w-[250px] block">
                        {d.reason}
                      </TooltipTrigger>
                      <TooltipContent>{d.reason}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium">{d.count}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">
                    {total > 0 ? ((d.count / total) * 100).toFixed(1) : '0.0'}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export const ReasonBreakdown = ({ topCancelReasons, topRescheduleReasons }: ReasonBreakdownProps) => {
  const cancelData = topCancelReasons.slice(0, 10).map(d => ({
    ...d,
    reason: d.reason || 'Unspecified',
  }));
  const rescheduleData = topRescheduleReasons.slice(0, 10).map(d => ({
    ...d,
    reason: d.reason || 'Unspecified',
  }));

  if (cancelData.length === 0 && rescheduleData.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-6 md:grid-cols-2">
        {cancelData.length > 0 && (
          <ReasonChart
            data={cancelData}
            title="Top Cancellation Reasons"
            description="From Canceled/Missed/Rescheduled report"
            color="hsl(var(--destructive))"
          />
        )}
        {rescheduleData.length > 0 && (
          <ReasonChart
            data={rescheduleData}
            title="Top Reschedule Reasons"
            description="From Canceled/Missed/Rescheduled report"
            color="hsl(var(--warning))"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center italic">
        Source: Canceled/Missed/Rescheduled report only. Counts do not affect KPI denominators.
      </p>
    </div>
  );
};
