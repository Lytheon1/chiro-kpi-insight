import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import type { MetricWithEvidence, MetricConfidence } from '@/types/evidence';

const config: Record<MetricConfidence, {
  label: string;
  icon: typeof ShieldCheck;
  badgeClass: string;
}> = {
  high: {
    label: 'High Confidence',
    icon: ShieldCheck,
    badgeClass: 'bg-success/10 text-success border-success/30 hover:bg-success/20',
  },
  medium: {
    label: 'Review',
    icon: ShieldAlert,
    badgeClass: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20',
  },
  low: {
    label: 'Low Confidence',
    icon: ShieldQuestion,
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20',
  },
};

interface ConfidenceBadgeProps {
  evidence?: MetricWithEvidence<any>;
  confidence?: MetricConfidence;
  compact?: boolean;
}

export function ConfidenceBadge({ evidence, confidence: overrideConfidence, compact }: ConfidenceBadgeProps) {
  const conf = overrideConfidence ?? evidence?.confidence ?? 'low';
  const cfg = config[conf];
  const Icon = cfg.icon;

  if (!evidence) {
    return (
      <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.badgeClass}`}>
        <Icon className="h-3 w-3" />
        {!compact && cfg.label}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex">
          <Badge variant="outline" className={`text-[10px] gap-1 cursor-pointer ${cfg.badgeClass}`}>
            <Icon className="h-3 w-3" />
            {!compact && cfg.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs space-y-2" align="start">
        <div className="font-semibold text-sm flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {cfg.label}
        </div>
        <div className="space-y-1.5 text-muted-foreground">
          <div><span className="font-medium text-foreground">Formula:</span> {evidence.formula}</div>
          <div><span className="font-medium text-foreground">Numerator:</span> {evidence.numeratorRows.length} rows</div>
          <div><span className="font-medium text-foreground">Denominator:</span> {evidence.denominatorRows.length} rows</div>
          <div><span className="font-medium text-foreground">Source:</span> Report {evidence.sourceReports.join(' + ')}</div>
          <div><span className="font-medium text-foreground">Scope:</span> {evidence.scope.replace(/_/g, ' ')}</div>
          {evidence.confidenceNote && (
            <div className="pt-1 border-t text-[11px]">{evidence.confidenceNote}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
