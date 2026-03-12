import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Info, AlertTriangle } from 'lucide-react';
import type { CarePathAnalysisResult, ProviderCarePathMetrics } from '@/types/reports';

interface CarePathSectionProps {
  analysis: CarePathAnalysisResult;
}

const classificationLabels: Record<string, string> = {
  progressed_as_expected: 'Progressed as Expected',
  maintenance_phase_only: 'Maintenance Phase Only',
  possible_progression_gap: 'Possible Progression Gap',
  quarter_boundary_unclear: 'Quarter-Boundary Unclear',
  disruption_heavy: 'Disruption Heavy',
  needs_review: 'Needs Review',
};

const scoreColor = (score: number): string => {
  if (score >= 70) return 'bg-success/15 text-success border-success/30';
  if (score >= 40) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-destructive/10 text-destructive/80 border-destructive/20';
};

export const CarePathSection = ({ analysis }: CarePathSectionProps) => {
  const [showAllProviders, setShowAllProviders] = useState(false);

  if (!analysis.isPathAnalysisReliable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Care Path Integrity
            <Badge variant="outline" className="text-warning border-warning/30">Limited</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>
              Patient names are missing from {analysis.missingNamePercentage.toFixed(0)}% of rows.
              Care Path analysis requires patient names to track visit progression.
              Path-based scoring has been disabled. All non-path KPIs remain accurate.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleProviders = showAllProviders
    ? analysis.providerMetrics
    : analysis.providerMetrics.slice(0, 3);

  // Classification breakdown across all journeys
  const totalJourneys = analysis.journeys.length;
  const classBreakdown = analysis.journeys.reduce<Record<string, number>>((acc, j) => {
    acc[j.classification] = (acc[j.classification] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Care Path Integrity
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  Care Path Integrity highlights whether patients tend to move through the expected
                  visit sequence after ROF, or whether treatment paths appear to end early or divert
                  quickly into maintenance-style visits. This is a directional operational pattern —
                  not a clinical quality judgment.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Period disclaimer */}
        <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border">
          <strong>Note:</strong> Care-path insights are based only on the selected date range.
          Patients who completed a treatment plan before this period may appear as maintenance-only
          visits, which is expected and normal.
        </div>

        {/* Interpretation Notes */}
        <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border space-y-1">
          <strong>Interpretation Notes:</strong>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Maintenance-only patterns may be normal for patients already in a long-term plan.</li>
            <li>Quarter-end ROFs may not yet show follow-through within this reporting window.</li>
            <li>Path insights are directional and operational, not clinical judgments.</li>
          </ul>
        </div>

        {/* Classification breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-2">Patient Classification ({totalJourneys} patients tracked)</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(classBreakdown).map(([cls, count]) => (
              <div key={cls} className="flex items-center justify-between p-2 rounded-md bg-muted/40 border text-xs">
                <span>{classificationLabels[cls] ?? cls}</span>
                <Badge variant="outline" className="text-[10px]">{count}</Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span>Context buckets (not problems): Maintenance-Phase Only: {analysis.maintenanceOnlyCount} | Quarter-Boundary Unclear: {analysis.quarterBoundaryUnclearCount}</span>
          </div>
        </div>

        {/* Provider cards */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Provider Care Path Summary</h4>
          {visibleProviders.map(pm => (
            <ProviderCarePathCard key={pm.provider} metrics={pm} />
          ))}
          {analysis.providerMetrics.length > 3 && (
            <button
              onClick={() => setShowAllProviders(!showAllProviders)}
              className="text-sm text-primary hover:underline"
            >
              {showAllProviders ? 'Show less' : `Show all ${analysis.providerMetrics.length} providers`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ProviderCarePathCard = ({ metrics: pm }: { metrics: ProviderCarePathMetrics }) => (
  <div className="p-4 rounded-md border bg-card space-y-3">
    <div className="flex items-center justify-between">
      <h5 className="font-medium text-sm">{pm.provider}</h5>
      <Badge className={`${scoreColor(pm.carePathIntegrityScore)} text-sm font-bold`}>
        Score: {pm.carePathIntegrityScore}
      </Badge>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <div>
        <div className="text-muted-foreground">New Patients</div>
        <div className="font-medium">{pm.newPatientCount}</div>
      </div>
      <div>
        <div className="text-muted-foreground">ROFs</div>
        <div className="font-medium">{pm.rofCount}</div>
      </div>
      <div>
        <div className="text-muted-foreground">NP→ROF %</div>
        <div className="font-medium">{(pm.npToRofConversionRate * 100).toFixed(0)}%</div>
      </div>
      <div>
        <div className="text-muted-foreground">ROF→Active Tx %</div>
        <div className="font-medium">{(pm.rofToActiveTreatmentRate * 100).toFixed(0)}%</div>
      </div>
      <div>
        <div className="text-muted-foreground">ROF→SC Direct</div>
        <div className="font-medium">{pm.directToScCount}</div>
      </div>
      <div>
        <div className="text-muted-foreground">ROF→LTC Direct</div>
        <div className="font-medium">{pm.directToLtcCount}</div>
      </div>
      <div>
        <div className="text-muted-foreground">ROF No Follow-Through</div>
        <div className="font-medium">{pm.rofNoFollowThroughCount}</div>
      </div>
    </div>
  </div>
);
