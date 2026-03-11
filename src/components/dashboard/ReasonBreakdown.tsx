import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ReasonBreakdownProps {
  topCancelReasons: Array<{ reason: string; count: number }>;
  topRescheduleReasons: Array<{ reason: string; count: number }>;
}

export const ReasonBreakdown = ({ topCancelReasons, topRescheduleReasons }: ReasonBreakdownProps) => {
  const cancelData = topCancelReasons.slice(0, 10);
  const rescheduleData = topRescheduleReasons.slice(0, 10);

  if (cancelData.length === 0 && rescheduleData.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-6 md:grid-cols-2">
        {cancelData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Cancellation Reasons</CardTitle>
              <CardDescription>From Canceled/Missed/Rescheduled report</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, cancelData.length * 32)}>
                <BarChart data={cancelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" className="text-xs" />
                  <YAxis
                    type="category"
                    dataKey="reason"
                    className="text-xs"
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="Cancellations" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {rescheduleData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Reschedule Reasons</CardTitle>
              <CardDescription>From Canceled/Missed/Rescheduled report</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, rescheduleData.length * 32)}>
                <BarChart data={rescheduleData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" className="text-xs" />
                  <YAxis
                    type="category"
                    dataKey="reason"
                    className="text-xs"
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="Reschedules" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center italic">
        Source: Canceled/Missed/Rescheduled report only. Counts do not affect KPI denominators.
      </p>
    </div>
  );
};
