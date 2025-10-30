import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  goal?: string | number;
  status?: 'success' | 'warning' | 'error';
  subtitle?: string;
  variance?: string;
  onClick?: () => void;
}

export const KPICard = ({ title, value, goal, status, subtitle, variance, onClick }: KPICardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-success';
      case 'warning':
        return 'text-warning';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case 'success':
        return 'bg-success/10 border-success/20';
      case 'warning':
        return 'bg-warning/10 border-warning/20';
      case 'error':
        return 'bg-destructive/10 border-destructive/20';
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'success':
        return <TrendingUp className="h-5 w-5" />;
      case 'error':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <Minus className="h-5 w-5" />;
    }
  };

  return (
    <Card 
      className={cn(
        'border-2',
        status && getStatusBg(),
        onClick && 'cursor-pointer hover:bg-accent/50 transition-colors'
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {status && (
          <div className={getStatusColor()}>
            {getIcon()}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {goal && (
          <p className="text-sm text-muted-foreground mt-1">
            Goal: {goal}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {variance && (
          <p className={cn('text-sm font-medium mt-2', getStatusColor())}>
            {variance}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
