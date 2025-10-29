import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { WeeklyData } from '@/types/dashboard';

interface WeeklyChartProps {
  data: WeeklyData[];
}

export const WeeklyChart = ({ data }: WeeklyChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Kept Appointments</CardTitle>
        <CardDescription>Trend of completed non-massage appointments per week</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="weekStart" 
              className="text-xs"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis className="text-xs" />
            <Tooltip 
              labelFormatter={(value) => `Week of ${new Date(value).toLocaleDateString()}`}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="keptAppointments" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Kept Appointments"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
