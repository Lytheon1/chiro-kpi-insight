/**
 * Patient Flow page — funnel + three-metric retention framework.
 * All funnel stages and retention cards are clickable with drilldown panels.
 */
import { useState, useMemo } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_BG, STATUS_LABELS } from '@/lib/kpi/benchmarks';
import { DrilldownPanel } from '@/components/DrilldownPanel';
import { buildFunnelDrilldown, buildCareContinuationDrilldown } from '@/lib/drilldown/types';
import type { DrilldownDataset } from '@/lib/drilldown/types';

const FUNNEL_BAR_COLORS = ['hsl(213, 63%, 40%)', 'hsl(190, 80%, 35%)', 'hsl(160, 60%, 35%)', 'hsl(270, 50%, 45%)', 'hsl(30, 80%, 35%)'];

export default function PatientFlowPage() {
  const { patientFunnel, metrics } = useDashboard();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activeDrilldown, setActiveDrilldown] = useState<DrilldownDataset | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<'all' | 'numerator' | 'failed'>('all');

  if (!patientFunnel || !metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No data available. Upload reports first.
        </CardContent>
      </Card>
    );
  }

  const max = patientFunnel.stages[0]?.count || 1;

  // Schedule Reliability: provider-relevant visits (excludes massage + admin)
  const schedReliability = metrics.scheduledNonMassage > 0 ? (metrics.completedNonMassage / metrics.scheduledNonMassage * 100) : 0;
  const treatmentFollowThrough = patientFunnel.rofPatientCount > 0 ? (patientFunnel.txStartedCount / patientFunnel.rofPatientCount * 100) : 0;
  const careContinuation = patientFunnel.txStartedCount > 0 ? (patientFunnel.activeCareCount / patientFunnel.txStartedCount * 100) : 0;

  const benchmarkMap: Record<string, { excellent: number; healthy: number; watch: number }> = {
    scheduleReliability: { excellent: 90, healthy: 82, watch: 75 },
    treatmentFollowThrough: { excellent: 90, healthy: 82, watch: 70 },
    careContinuation: { excellent: 85, healthy: 70, watch: 55 },
  };

  function getStatus(value: number, key: string) {
    const t = benchmarkMap[key];
    if (!t) return 'watch' as const;
    if (value >= t.excellent) return 'excellent' as const;
    if (value >= t.healthy) return 'healthy' as const;
    if (value >= t.watch) return 'watch' as const;
    return 'risk' as const;
  }

  function getBarColor(status: string) {
    return status === 'excellent' ? 'hsl(var(--success))' :
           status === 'healthy' ? 'hsl(152 48% 42%)' :
           status === 'watch' ? 'hsl(var(--warning))' :
           'hsl(var(--destructive))';
  }

  const handleFunnelClick = (stageLabel: string, stageIndex: number) => {
    const patients = patientFunnel.stagePatients[stageLabel] || [];
    const dataset = buildFunnelDrilldown(stageLabel, patients, patientFunnel.stages, stageIndex);
    setActiveDrilldown(dataset);
    setDrilldownTab('all');
    setExpandedStage(null);
  };

  const handleCareContinuationClick = () => {
    const txPatients = patientFunnel.stagePatients['Treatment Started'] || [];
    const acPatients = patientFunnel.stagePatients['Active Care (3+)'] || [];
    const dataset = buildCareContinuationDrilldown(txPatients, acPatients);
    setActiveDrilldown(dataset);
    setDrilldownTab('failed'); // Default to "Did Not Continue"
  };

  const handleRetentionClick = (key: string) => {
    if (key === 'careContinuation') {
      handleCareContinuationClick();
    } else if (key === 'treatmentFollowThrough') {
      const rofPatients = patientFunnel.stagePatients['ROF Completed'] || [];
      const txPatients = patientFunnel.stagePatients['Treatment Started'] || [];
      const txNames = new Set(txPatients.map(p => p.name.toLowerCase()));
      const allPatients = rofPatients.map(p => ({
        ...p,
        patientName: p.name,
        patientKey: p.name.toLowerCase().replace(/[^a-z,]/g, ''),
        evidenceRows: [],
        _isContinued: txNames.has(p.name.toLowerCase()),
      }));
      setActiveDrilldown({
        key: 'treatment_follow_through',
        label: 'Treatment Follow-Through',
        description: 'Patients who completed ROF and whether they started treatment.',
        mode: 'patient',
        patients: allPatients,
        summary: {
          totalPatients: rofPatients.length,
          totalEvidenceRows: 0,
          numerator: txPatients.length,
          denominator: rofPatients.length,
          pct: rofPatients.length > 0 ? (txPatients.length / rofPatients.length) * 100 : 0,
          formula: `Treatment starters / ROF patients = ${txPatients.length} / ${rofPatients.length}`,
        },
      });
      setDrilldownTab('failed');
    }
    // Schedule Reliability is visit-based, not patient-based — no patient drilldown
  };

  const retentionMetrics = [
    {
      label: 'Schedule Reliability',
      value: schedReliability,
      sub: `${metrics.completedNonMassage} / ${metrics.scheduledNonMassage} provider visits`,
      type: 'visit-based (excl. massage/admin)',
      meaning: `Provider-relevant completed visits ÷ scheduled visits. Excludes massage, therapy-only, and admin visits.`,
      benchmarkKey: 'scheduleReliability' as const,
      clickable: false,
    },
    {
      label: 'Treatment Follow-Through',
      value: treatmentFollowThrough,
      sub: `${patientFunnel.txStartedCount} / ${patientFunnel.rofPatientCount} patients`,
      type: 'patient-based',
      meaning: `Patients who began treatment after ROF. ${patientFunnel.txStartedCount} of ${patientFunnel.rofPatientCount} ROF patients started care.`,
      benchmarkKey: 'treatmentFollowThrough' as const,
      clickable: true,
    },
    {
      label: 'Care Continuation',
      value: careContinuation,
      sub: `${patientFunnel.activeCareCount} / ${patientFunnel.txStartedCount} patients`,
      type: 'patient-based',
      meaning: `Patients who reached 3+ treatment visits after starting. ${patientFunnel.activeCareCount} of ${patientFunnel.txStartedCount} starters.`,
      benchmarkKey: 'careContinuation' as const,
      clickable: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Retention Trio */}
      <div>
        <div className="text-[9px] font-bold tracking-widest uppercase text-faint mb-3">Three-Metric Retention Framework</div>
        <div className="grid gap-4 md:grid-cols-3">
          {retentionMetrics.map(m => {
            const status = getStatus(m.value, m.benchmarkKey);
            const color = getBarColor(status);
            const isWeak = m.value < 60;
            return (
              <div
                key={m.label}
                className={`bg-card border rounded-lg p-5 text-center shadow-sm transition-all ${isWeak ? 'border-warning/50' : ''} ${m.clickable ? 'cursor-pointer hover:shadow-md hover:border-secondary' : ''}`}
                onClick={() => m.clickable && handleRetentionClick(m.benchmarkKey)}
              >
                <div className="retention-value" style={isWeak ? { color: 'hsl(var(--warning))' } : {}}>
                  {m.value.toFixed(1)}%
                </div>
                <div className="text-[12px] font-semibold text-primary mt-1">{m.label}</div>
                <div className="text-[10px] text-faint italic mb-2">{m.type}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">{m.meaning}</div>
                <div className="mt-3 flex justify-center">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_BG[status]}`}>
                    <span className="w-1 h-1 rounded-full inline-block mr-1" style={{ background: color }} />
                    {STATUS_LABELS[status]}
                  </Badge>
                </div>
                <div className="mt-2 benchmark-bar-track">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, m.value)}%`, background: color }} />
                </div>
                {m.clickable && (
                  <div className="text-[10px] text-secondary font-medium mt-2">Click to see patients →</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight */}
      {careContinuation < 65 && (
        <div className="insight-block insight-block-medium cursor-pointer" onClick={handleCareContinuationClick}>
          <Badge variant="outline" className="text-[10px] mb-1.5 bg-warning/10 text-warning border-warning/30">○ Review</Badge>
          <div className="text-[13px] font-semibold text-primary">
            Care continuation ({careContinuation.toFixed(0)}%) is the weakest retention metric — {patientFunnel.txStartedCount - patientFunnel.activeCareCount} patients started but did not establish regular care
          </div>
          <div className="text-[12px] text-muted-foreground mt-2">
            High Treatment Follow-Through ({treatmentFollowThrough.toFixed(0)}%) combined with low Care Continuation suggests patients accept the care plan initially but taper off before establishing a regular cadence.
          </div>
          <div className="text-[10px] text-secondary font-medium mt-1">Click to see which patients did not continue →</div>
        </div>
      )}

      {/* Drilldown Panel */}
      {activeDrilldown && (
        <DrilldownPanel
          dataset={activeDrilldown}
          onClose={() => setActiveDrilldown(null)}
          showTabs={activeDrilldown.summary.denominator !== undefined}
          tabFilter={drilldownTab}
          onTabChange={setDrilldownTab}
        />
      )}

      {/* Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[13px] font-semibold text-primary flex items-center gap-2">
              Patient Care Funnel
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-faint" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Click any stage to see the patients behind that number. Stage counts reflect unique patients who completed each care stage.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <span className="evidence-label">EVIDENCE</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {patientFunnel.stages.map((s, i) => (
              <div
                key={s.label}
                className="flex items-center gap-3 py-2.5 px-3 rounded cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => handleFunnelClick(s.label, i)}
              >
                <div className="flex-1">
                  <div className="text-[12px] font-medium text-primary mb-1">{s.label}</div>
                  <div className="funnel-bar-track">
                    <div
                      className="funnel-bar-fill"
                      style={{ width: `${(s.count / max) * 100}%`, background: FUNNEL_BAR_COLORS[i] || FUNNEL_BAR_COLORS[0] }}
                    />
                  </div>
                </div>
                <div className="font-mono text-lg font-medium text-primary min-w-[30px] text-right">{s.count}</div>
                <div className="text-[11px] text-muted-foreground min-w-[48px]">
                  {s.conversionRate !== null ? `${(s.conversionRate * 100).toFixed(0)}%` : ''}
                </div>
                {s.dropOff > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-[11px] text-destructive min-w-[70px]">
                        ↓ {s.dropOff} {s.label === 'Maintenance / SC' ? 'without maintenance' : 'lost'}
                      </div>
                    </TooltipTrigger>
                    {s.label === 'Maintenance / SC' && (
                      <TooltipContent className="max-w-xs text-xs">
                        These patients finished their treatment plan. Some may return; only count as lost if no future visit is scheduled.
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
              </div>
            ))}
          </div>

          <div className="text-[10px] text-faint mt-3 p-2.5 rounded border bg-muted/30">
            Stage counts reflect unique patients who completed each care stage. Click any stage to see the patient list. Total visit counts are shown separately in schedule metrics.
          </div>
        </CardContent>
      </Card>

      {/* Retention insight text block */}
      <div className="text-[11px] text-muted-foreground p-4 rounded border bg-muted/30 leading-relaxed">
        These three metrics together tell whether patients show up reliably (Schedule Reliability),
        accept treatment plans (Follow-Through), and commit to the full care sequence (Continuation).
        A high reliability with low continuation may indicate patients attend but leave before care is complete.
      </div>
    </div>
  );
}
