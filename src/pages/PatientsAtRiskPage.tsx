/**
 * Patients at Risk page — risk scoring combining Report A + Report B.
 * Uses normalizePatientKey for fuzzy patient name matching.
 */
import { useState, useMemo } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const RISK_COLORS: Record<RiskLevel, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground border-muted',
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
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Upload reports to see patient risk analysis.
        </CardContent>
      </Card>
    );
  }

  const filteredPatients = useMemo(() => {
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const exportCSV = () => {
    const data = filteredPatients.map(p => ({
      Patient: p.patientName,
      Provider: p.provider,
      'Risk Score': p.riskScore,
      'Risk Level': p.riskLevel,
      'Last Visit': p.lastVisitDate,
      Cancellations: p.breakdown.cancellations,
      Reschedules: p.breakdown.reschedules,
      'No-Shows': p.breakdown.noShows,
      Action: p.suggestedAction,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `patients-at-risk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Patients at Risk</h2>
        <p className="text-xs text-muted-foreground">
          Patients showing disruption patterns that predict drop-out.
        </p>
      </div>

      {/* Summary Strip */}
      <div className="grid gap-3 grid-cols-3">
        {(['high', 'medium', 'low'] as const).map(level => (
          <Card
            key={level}
            className={`cursor-pointer transition-colors hover:bg-accent/30 ${selectedRisk === level ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedRisk(selectedRisk === level ? 'all' : level)}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">
                {level === 'high' ? patientRisk.highRiskCount
                  : level === 'medium' ? patientRisk.mediumRiskCount
                  : patientRisk.lowRiskCount}
              </div>
              <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[level]}`}>
                {RISK_LABELS[level]}
              </Badge>
              <div className="text-[10px] text-muted-foreground mt-1">
                {level === 'high' ? 'Score ≥ 6' : level === 'medium' ? 'Score 3–5' : 'Score 1–2'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Drivers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Risk Driver Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Repeat Reschedules', value: patientRisk.riskDrivers.repeatReschedules },
              { label: 'Multiple Cancellations', value: patientRisk.riskDrivers.multipleCancellations },
              { label: 'Visit Gaps > 14 days', value: patientRisk.riskDrivers.visitGaps14 },
              { label: 'ROF with No Treatment', value: patientRisk.riskDrivers.rofNoTreatment },
            ].map(d => (
              <div key={d.label} className="p-3 rounded border bg-muted/30">
                <div className="text-lg font-bold">{d.value}</div>
                <div className="text-[10px] text-muted-foreground">{d.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-xs font-medium">
              {filteredPatients.length} patients
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-7 text-xs">
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search patient or provider..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {allProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('patientName')}>Patient{sortArrow('patientName')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('riskScore')}>Risk Score{sortArrow('riskScore')}</TableHead>
                  <TableHead className="text-[10px]">Level</TableHead>
                  <TableHead className="text-[10px]">Disruptions</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('lastVisitDate')}>Last Visit{sortArrow('lastVisitDate')}</TableHead>
                  <TableHead className="cursor-pointer select-none text-[10px]" onClick={() => handleSort('provider')}>Provider{sortArrow('provider')}</TableHead>
                  <TableHead className="text-[10px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.slice(0, 100).map((p, i) => (
                  <TableRow key={i} className="cursor-pointer hover:bg-accent/30" onClick={() => setSelectedPatient(p)}>
                    <TableCell className="text-[10px] font-medium">{p.patientName}</TableCell>
                    <TableCell className="text-[10px] font-bold">{p.riskScore}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${RISK_COLORS[p.riskLevel]}`}>
                        {RISK_LABELS[p.riskLevel]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {p.breakdown.cancellations > 0 && <span className="mr-1">{p.breakdown.cancellations}C</span>}
                      {p.breakdown.reschedules > 0 && <span className="mr-1">{p.breakdown.reschedules}R</span>}
                      {p.breakdown.noShows > 0 && <span>{p.breakdown.noShows}NS</span>}
                    </TableCell>
                    <TableCell className="text-[10px]">{p.lastVisitDate}</TableCell>
                    <TableCell className="text-[10px]">{p.provider}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">{p.suggestedAction}</TableCell>
                  </TableRow>
                ))}
                {filteredPatients.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No patients match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredPatients.length > 100 && (
            <div className="text-[10px] text-muted-foreground">Showing first 100 of {filteredPatients.length}</div>
          )}
        </CardContent>
      </Card>

      {/* Risk Detail Modal */}
      {selectedPatient && (
        <Dialog open onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {selectedPatient.patientName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold">{selectedPatient.riskScore}</div>
                <Badge variant="outline" className={`${RISK_COLORS[selectedPatient.riskLevel]}`}>
                  {RISK_LABELS[selectedPatient.riskLevel]}
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-semibold">Score Breakdown</h4>
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
                <h4 className="font-semibold">Suggested Next Step</h4>
                <p className="text-muted-foreground">{selectedPatient.suggestedAction}</p>
              </div>

              <div className="text-[10px] text-muted-foreground border-t pt-2">
                Provider: {selectedPatient.provider} | Last visit: {selectedPatient.lastVisitDate} | {selectedPatient.visitCount} total visits
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
