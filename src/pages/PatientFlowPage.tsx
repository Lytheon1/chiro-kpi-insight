/**
 * Patient Flow page — full funnel visualization + detailed stage data.
 * Uses UNIQUE PATIENT COUNTS, not visit row counts.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import {
  FunnelChart, Funnel, LabelList, Cell,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import type { FunnelPatient } from '@/lib/kpi/patientFunnel';

const FUNNEL_COLORS = [
  'hsl(220, 40%, 22%)',
  'hsl(220, 35%, 32%)',
  'hsl(220, 30%, 42%)',
  'hsl(220, 25%, 55%)',
  'hsl(220, 20%, 68%)',
];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '11px',
};

export default function PatientFlowPage() {
  const { patientFunnel, sequenceAnalysis, metrics, carePathAnalysis } = useDashboard();
  const navigate = useNavigate();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  if (!patientFunnel || !metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No data available. Upload reports first.
        </CardContent>
      </Card>
    );
  }

  const funnelData = patientFunnel.stages
    .filter(s => s.count > 0 || s.label === 'New Patients')
    .map((s, i) => ({
      name: s.label,
      value: s.count,
      fill: FUNNEL_COLORS[i] || FUNNEL_COLORS[FUNNEL_COLORS.length - 1],
      conversionRate: s.conversionRate,
      dropOff: s.dropOff,
      dropOffLabel: s.dropOffLabel,
    }));

  // Find worst drop-off stage
  const worstDropIdx = patientFunnel.stages.reduce((maxIdx, s, i, arr) => {
    if (i === 0) return maxIdx;
    const rate = s.conversionRate ?? 1;
    const maxRate = arr[maxIdx]?.conversionRate ?? 1;
    return rate < maxRate ? i : maxIdx;
  }, 1);

  const toggleStage = (label: string) => {
    setExpandedStage(expandedStage === label ? null : label);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Patient Flow</h2>
        <p className="text-xs text-muted-foreground">
          Care progression funnel based on <strong>unique patients</strong>, not visit counts.
        </p>
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Patient Care Funnel
            <Tooltip>
              <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Stage counts reflect unique patients who completed each care stage.
                Total visit counts are shown separately in schedule metrics.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string, entry: any) => {
                  const d = entry.payload;
                  const parts = [`${value} patients`];
                  if (d.conversionRate !== null && d.conversionRate !== undefined) {
                    parts.push(`${(d.conversionRate * 100).toFixed(0)}% conversion`);
                  }
                  if (d.dropOff > 0) parts.push(`${d.dropOff} dropped`);
                  return parts.join(' | ');
                }}
              />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="center" fill="white" fontSize={12} formatter={(v: number) => v} />
                <LabelList position="right" fill="hsl(var(--muted-foreground))" fontSize={10} dataKey="name" />
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>

          <div className="text-[10px] text-muted-foreground mt-3 p-2.5 rounded bg-muted/50 border">
            Stage counts reflect unique patients who completed each care stage.
            Total visit counts are shown separately in schedule metrics.
          </div>
        </CardContent>
      </Card>

      {/* Stage Transitions */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {patientFunnel.stages.slice(1).map((stage, i) => {
          const isWorst = i + 1 === worstDropIdx;
          return (
            <Card
              key={stage.label}
              className={`cursor-pointer transition-colors hover:bg-accent/30 ${isWorst ? 'border-warning/50' : ''}`}
              onClick={() => toggleStage(stage.label)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">{stage.label}</span>
                  {isWorst && <Badge variant="outline" className="text-[8px] bg-warning/10 text-warning border-warning/30">Biggest Drop</Badge>}
                </div>
                <div className="text-xl font-bold">{stage.count}</div>
                {stage.conversionRate !== null && (
                  <div className="text-xs text-muted-foreground">
                    {(stage.conversionRate * 100).toFixed(0)}% conversion
                  </div>
                )}
                {stage.dropOff > 0 && (
                  <div className="text-[10px] text-destructive/70 mt-1">
                    {stage.dropOffLabel}
                  </div>
                )}
                <div className="text-[10px] text-primary mt-1 flex items-center gap-1">
                  {expandedStage === stage.label ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                  View patients
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expanded Patient List */}
      {expandedStage && patientFunnel.stagePatients[expandedStage] && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold">{expandedStage} — {patientFunnel.stagePatients[expandedStage].length} patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded border overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Patient</TableHead>
                    <TableHead className="text-[10px]">Provider</TableHead>
                    <TableHead className="text-[10px]">Last Visit</TableHead>
                    <TableHead className="text-[10px] text-right">Visits</TableHead>
                    <TableHead className="text-[10px]">Stages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientFunnel.stagePatients[expandedStage].map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[10px]">{p.name}</TableCell>
                      <TableCell className="text-[10px]">{p.provider}</TableCell>
                      <TableCell className="text-[10px]">{p.lastVisitDate}</TableCell>
                      <TableCell className="text-[10px] text-right">{p.completedVisitCount}</TableCell>
                      <TableCell className="text-[10px]">
                        {p.stages.map(s => (
                          <Badge key={s} variant="outline" className="text-[8px] mr-0.5">{s}</Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Three-Metric Retention Framework */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Three-Metric Retention Framework</CardTitle>
          <CardDescription className="text-xs">
            Three connected views of patient retention across the care journey.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Schedule Reliability</div>
              <div className="text-2xl font-bold">
                {metrics.totalScheduled > 0 ? ((metrics.totalCompleted / metrics.totalScheduled) * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.totalCompleted} / {metrics.totalScheduled} visits
              </div>
              <div className="text-[9px] text-muted-foreground mt-1 border-t pt-1">visit-based</div>
              <div className="text-[10px] text-muted-foreground mt-1">How well the appointment schedule holds</div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Treatment Follow-Through</div>
              <div className="text-2xl font-bold">
                {patientFunnel.rofPatientCount > 0
                  ? ((patientFunnel.txStartedCount / patientFunnel.rofPatientCount) * 100).toFixed(0)
                  : '0'}%
              </div>
              <div className="text-xs text-muted-foreground">
                {patientFunnel.txStartedCount} / {patientFunnel.rofPatientCount} patients
              </div>
              <div className="text-[9px] text-muted-foreground mt-1 border-t pt-1">patient-based</div>
              <div className="text-[10px] text-muted-foreground mt-1">Patients who began care after ROF</div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Care Continuation</div>
              <div className="text-2xl font-bold">
                {patientFunnel.txStartedCount > 0
                  ? ((patientFunnel.activeCareCount / patientFunnel.txStartedCount) * 100).toFixed(0)
                  : '0'}%
              </div>
              <div className="text-xs text-muted-foreground">
                {patientFunnel.activeCareCount} / {patientFunnel.txStartedCount} patients
              </div>
              <div className="text-[9px] text-muted-foreground mt-1 border-t pt-1">patient-based</div>
              <div className="text-[10px] text-muted-foreground mt-1">Patients with 3+ treatment visits</div>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground mt-4 p-2.5 rounded bg-muted/50 border">
            These three metrics together tell whether patients show up reliably (Schedule Reliability),
            accept treatment plans (Follow-Through), and commit to the full care sequence (Continuation).
            A high reliability with low continuation may indicate patients attend but leave before care is complete.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
