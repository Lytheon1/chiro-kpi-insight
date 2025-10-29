import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { WeeklyData } from '@/types/dashboard';

interface ROFChartProps {
  data: WeeklyData[];
  goal: number;
}

export const ROFChart = ({ data, goal }: ROFChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ROF Completion Rate by Week</CardTitle>
        <CardDescription>Weekly ROF appointment completion percentage</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="weekStart" 
              className="text-xs"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis className="text-xs" domain={[0, 100]} />
            <Tooltip 
              labelFormatter={(value) => `Week of ${new Date(value).toLocaleDateString()}`}
              formatter={(value: number) => `${value.toFixed(1)}%`}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <ReferenceLine y={goal} stroke="hsl(var(--success))" strokeDasharray="3 3" label="Goal" />
            <Bar 
              dataKey="rofCompletionRate" 
              fill="hsl(var(--secondary))" 
              name="ROF Completion %"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
