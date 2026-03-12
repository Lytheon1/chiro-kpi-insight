/**
 * Patients at Risk page — risk scoring with consulting-grade design.
 */
import { useState, useMemo } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import type { PatientRisk, RiskLevel } from '@/lib/kpi/patientRisk';

const RISK_BADGE: Record<RiskLevel, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground',
};

const RISK_PILL: Record<RiskLevel, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Low Risk',
};

type SortKey = 'riskScore' | 'patientName' | 'provider' | 'lastVisitDate';

export default function PatientsAtRiskPage() {
  const { patientRisk, allProviders } = useDashboard();
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | 'all'>('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedPatient, setSelectedPatient] = useState<PatientRisk | null>(null);

  const filteredPatients = useMemo(() => {
    if (!patientRisk) return [];
    let list = patientRisk.patients;
    if (selectedRisk !== 'all') list = list.filter(p => p.riskLevel === selectedRisk);
    if (selectedProvider !== 'all') list = list.filter(p => p.provider === selectedProvider);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.patientName.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'riskScore': cmp = a.riskScore - b.riskScore; break;
        case 'patientName': cmp = a.patientName.localeCompare(b.patientName); break;
        case 'provider': cmp = a.provider.localeCompare(b.provider); break;
        case 'lastVisitDate': cmp = a.lastVisitDate.localeCompare(b.lastVisitDate); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [patientRisk, selectedRisk, selectedProvider, search, sortKey, sortDir]);

  if (!patientRisk) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
        Upload reports to see patient risk analysis.
      </CardContent></Card>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const exportCSV = () => {
    const data = filteredPatients.map(p => ({
      Patient: p.patientName, Provider: p.provider, 'Risk Score': p.riskScore,
      'Risk Level': p.riskLevel, 'Last Visit': p.lastVisitDate,
      Cancellations: p.breakdown.cancellations, Reschedules: p.breakdown.reschedules,
      'No-Shows': p.breakdown.noShows, Action: p.suggestedAction,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patients-at-risk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  // Risk drivers for horizontal bars
  const driverData = [
    { name: 'Multiple Cancellations', count: patientRisk.riskDrivers.multipleCancellations },
    { name: 'Repeat Reschedules (2+)', count: patientRisk.riskDrivers.repeatReschedules },
    { name: 'Visit Gap >14 days', count: patientRisk.riskDrivers.visitGaps14 },
    { name: 'ROF Without Treatment', count: patientRisk.riskDrivers.rofNoTreatment },
  ].sort((a, b) => b.count - a.count);
  const maxDriver = Math.max(...driverData.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid gap-4 grid-cols-3">
        {(['high', 'medium', 'low'] as const).map(level => {
          const count = level === 'high' ? patientRisk.highRiskCount
            : level === 'medium' ? patientRisk.mediumRiskCount
            : patientRisk.lowRiskCount;
          const isActive = selectedRisk === level;
          return (
            <div
              key={level}
              className={`bg-card border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md
                ${isActive ? 'ring-2 ring-secondary shadow-md' : ''}`}
              onClick={() => setSelectedRisk(isActive ? 'all' : level)}
            >
              <div className="text-[11px] text-faint font-medium tracking-wide uppercase">
                {level} Risk Patients
              </div>
              <div className={`kpi-value ${
                level === 'high' ? 'text-destructive' :
                level === 'medium' ? 'text-warning' : 'text-muted-foreground'
              }`}>{count}</div>
              <div className="text-[10px] text-faint mt-0.5">
                {level === 'high' ? 'Score ≥ 6 · Contact within 48 hours' :
                 level === 'medium' ? 'Score 3-5 · Confirm at next visit' :
                 'Score 1-2 · Monitor routinely'}
              </div>
              {isActive && <div className="text-[10px] text-secondary mt-1 font-medium">Click to clear filter →</div>}
            </div>
          );
        })}
      </div>

      {/* Insight block */}
      {patientRisk.highRiskCount > 0 && (
        <div className="insight-block insight-block-high">
          <Badge variant="outline" className="text-[10px] mb-1.5 bg-destructive/10 text-destructive border-destructive/30">⚠ High Priority</Badge>
          <div className="text-[13px] font-semibold text-primary">
            {patientRisk.highRiskCount} patients have behavioral patterns that frequently precede care dropout
          </div>
          <div className="text-[12px] text-muted-foreground mt-2">
            Risk scores combine reschedule frequency, cancellations, no-shows, and visit gaps.
            High scores indicate multiple co-occurring disruption patterns.
          </div>
        </div>
      )}

      {/* Risk Drivers — horizontal bars */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[13px] font-semibold text-primary">Risk Drivers</CardTitle>
            <span className="evidence-label">EVIDENCE</span>
          </div>
        </CardHeader>
        <CardContent>
          {driverData.map((row, i) => (
            <div key={row.name} className="flex items-center gap-3 mb-2">
              <div className="text-[12px] text-foreground min-w-[180px]">{row.name}</div>
              <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{
                  width: `${(row.count / maxDriver) * 100}%`,
                  background: i === 0 ? 'hsl(var(--destructive))' : 'hsl(var(--secondary))',
                }} />
              </div>
              <div className="font-mono text-[12px] text-muted-foreground min-w-[60px] text-right">{row.count} patients</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Patient Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-[13px] font-semibold text-primary">Patient Risk Roster</CardTitle>
            <div className="flex gap-2">
              {/* Filter tabs */}
              {['all', 'high', 'medium', 'low'].map(f => (
                <button
                  key={f}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-all ${
                    selectedRisk === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-secondary hover:text-secondary'
                  }`}
                  onClick={() => setSelectedRisk(f as any)}
                >
                  {f === 'all' ? `All (${patientRisk.patients.length})` :
                   `${f.charAt(0).toUpperCase() + f.slice(1)} (${f === 'high' ? patientRisk.highRiskCount : f === 'medium' ? patientRisk.mediumRiskCount : patientRisk.lowRiskCount})`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search patient or provider..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            {allProviders.length > 1 && (
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-8 text-xs">
              <Download className="h-3 w-3" /> Export
            </Button>
          </div>

          <div className="rounded border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide" onClick={() => handleSort('patientName')}>Patient{sortArrow('patientName')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide" onClick={() => handleSort('riskScore')}>Score{sortArrow('riskScore')}</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Level</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Disruptions</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide" onClick={() => handleSort('lastVisitDate')}>Last Visit{sortArrow('lastVisitDate')}</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.slice(0, 100).map((p, i) => (
                  <TableRow key={i} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedPatient(p)}>
                    <TableCell className="text-[13px]">{p.patientName}</TableCell>
                    <TableCell>
                      <span className={`risk-score-pill ${RISK_PILL[p.riskLevel]}`}>
                        {p.riskScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${RISK_BADGE[p.riskLevel]}`}>
                        {RISK_LABELS[p.riskLevel]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {[
                        p.breakdown.reschedules > 0 && `${p.breakdown.reschedules} reschedules`,
                        p.breakdown.cancellations > 0 && `${p.breakdown.cancellations} cancellation(s)`,
                        p.breakdown.noShows > 0 && `${p.breakdown.noShows} no-show(s)`,
                      ].filter(Boolean).join(', ')}
                    </TableCell>
                    <TableCell className="text-[12px]">{p.lastVisitDate}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate">{p.suggestedAction}</TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No patients match filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredPatients.length > 100 && (
            <div className="text-[10px] text-faint">Showing first 100 of {filteredPatients.length}</div>
          )}
        </CardContent>
      </Card>

      {/* Risk Detail Side Panel */}
      {selectedPatient && (
        <Dialog open onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-lg text-primary flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {selectedPatient.patientName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`risk-score-pill text-lg w-10 h-10 ${RISK_PILL[selectedPatient.riskLevel]}`}>
                  {selectedPatient.riskScore}
                </span>
                <Badge variant="outline" className={`${RISK_BADGE[selectedPatient.riskLevel]}`}>
                  {RISK_LABELS[selectedPatient.riskLevel]}
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-semibold text-primary">Score Breakdown</h4>
                <div className="space-y-1 text-muted-foreground">
                  {selectedPatient.breakdown.reschedules > 0 && (
                    <div>{selectedPatient.breakdown.reschedules} reschedules → +{selectedPatient.breakdown.reschedulePoints} pts</div>
                  )}
                  {selectedPatient.breakdown.cancellations > 0 && (
                    <div>{selectedPatient.breakdown.cancellations} cancellations → +{selectedPatient.breakdown.cancellationPoints} pts</div>
                  )}
                  {selectedPatient.breakdown.noShows > 0 && (
                    <div>{selectedPatient.breakdown.noShows} no-shows → +{selectedPatient.breakdown.noShowPoints} pts</div>
                  )}
                  {selectedPatient.breakdown.visitGap14 > 0 && (
                    <div>{selectedPatient.breakdown.visitGap14} visit gaps &gt;14 days → +{selectedPatient.breakdown.visitGap14Points} pts</div>
                  )}
                  {selectedPatient.breakdown.visitGap21 > 0 && (
                    <div>{selectedPatient.breakdown.visitGap21} visit gaps &gt;21 days → +{selectedPatient.breakdown.visitGap21Points} pts</div>
                  )}
                  {selectedPatient.breakdown.rofNoTreatment && (
                    <div>ROF with no treatment start → +{selectedPatient.breakdown.rofNoTreatmentPoints} pts</div>
                  )}
                  {selectedPatient.breakdown.canceledFirstTxAfterRof && (
                    <div>Canceled first treatment after ROF → +{selectedPatient.breakdown.canceledFirstTxPoints} pts</div>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <h4 className="font-semibold text-primary">Suggested Next Step</h4>
                <p className="text-muted-foreground">{selectedPatient.suggestedAction}</p>
              </div>

              <div className="text-[10px] text-faint border-t pt-2">
                Provider: {selectedPatient.provider} | Last visit: {selectedPatient.lastVisitDate} | {selectedPatient.visitCount} total visits
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}