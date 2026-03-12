import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DashboardFilters } from '@/types/reports';

interface KeywordsConfigProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export const KeywordsConfig = ({ filters, onFiltersChange }: KeywordsConfigProps) => {
  const update = (key: keyof DashboardFilters, value: string) => {
    const keywords = value.split(',').map(s => s.trim()).filter(Boolean);
    onFiltersChange({ ...filters, [key]: keywords });
  };

  const join = (arr: string[] | undefined) => (arr ?? []).join(', ');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keywords Configuration</CardTitle>
        <CardDescription>
          Define the keywords used to identify different appointment types and statuses.
          Changes re-derive all metrics in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KeywordInput label="Completed Keywords" value={join(filters.completedKeywords)} onChange={v => update('completedKeywords', v)} />
        <KeywordInput label="Canceled Keywords" value={join(filters.canceledKeywords)} onChange={v => update('canceledKeywords', v)} />
        <KeywordInput label="No Show Keywords" value={join(filters.noShowKeywords)} onChange={v => update('noShowKeywords', v)} />
        <KeywordInput label="Rescheduled Keywords" value={join(filters.rescheduledKeywords)} onChange={v => update('rescheduledKeywords', v)} />
        <KeywordInput label="ROF Keywords" value={join(filters.rofKeywords)} onChange={v => update('rofKeywords', v)} />
        <KeywordInput label="Massage Keywords" value={join(filters.massageKeywords)} onChange={v => update('massageKeywords', v)} />
        <KeywordInput label="New Patient Keywords" value={join(filters.newPatientKeywords)} onChange={v => update('newPatientKeywords', v)} />
        <KeywordInput label="Return Visit / Active Treatment" value={join(filters.returnVisitKeywords)} onChange={v => update('returnVisitKeywords', v)} />
        <KeywordInput label="Re-Exam Keywords" value={join(filters.reExamKeywords)} onChange={v => update('reExamKeywords', v)} />
        <KeywordInput label="Final Eval Keywords" value={join(filters.finalEvalKeywords)} onChange={v => update('finalEvalKeywords', v)} />
        <KeywordInput label="PTF Keywords" value={join(filters.ptfKeywords)} onChange={v => update('ptfKeywords', v)} />
        <KeywordInput label="Supportive Care Keywords" value={join(filters.supportiveCareKeywords)} onChange={v => update('supportiveCareKeywords', v)} />
        <KeywordInput label="LTC Keywords" value={join(filters.ltcKeywords)} onChange={v => update('ltcKeywords', v)} />
        <div className="sm:col-span-2 lg:col-span-3">
          <KeywordInput
            label="Excluded Purpose Keywords"
            value={join(filters.excludedPurposeKeywords)}
            onChange={v => update('excludedPurposeKeywords', v)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            These appointment types will be excluded from Retention Rate, Total Kept, and Weekly Average calculations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const KeywordInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="comma-separated keywords"
    />
  </div>
);
