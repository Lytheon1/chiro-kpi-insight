import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { DashboardFilters } from '@/types/reports';
import { saveFiltersToStorage } from '@/lib/utils/keywords';
import { DEFAULT_FILTERS } from '@/lib/kpi/calculateDashboardMetrics';

interface KeywordsConfigProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export const KeywordsConfig = ({ filters, onFiltersChange }: KeywordsConfigProps) => {
  const update = (key: keyof DashboardFilters, value: string) => {
    const keywords = value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const next = { ...filters, [key]: keywords };
    onFiltersChange(next);
    saveFiltersToStorage(next);
  };

  const handleBlur = () => {
    toast.success('Saved', { duration: 1500 });
  };

  const resetToDefaults = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
    saveFiltersToStorage(DEFAULT_FILTERS);
    toast.success('Keywords reset to defaults', { duration: 2000 });
  };

  const join = (arr: string[] | undefined) => (arr ?? []).join(', ');

  // Active exclusions summary
  const exclusions = [
    ...(filters.excludedPurposeKeywords ?? []),
    ...(filters.massageKeywords ?? []),
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Keywords Configuration</CardTitle>
            <CardDescription>
              Define the keywords used to identify different appointment types and statuses.
              Changes apply in real time. Values are saved automatically when you click away.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            Reset to Defaults
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {exclusions.length > 0 && (
          <div className="text-[10px] text-muted-foreground px-2 py-1.5 rounded bg-muted/50 border">
            Active exclusions: {exclusions.join(', ')} | Massage excluded from retention
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KeywordInput label="Completed Keywords" value={join(filters.completedKeywords)} onChange={v => update('completedKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Canceled Keywords" value={join(filters.canceledKeywords)} onChange={v => update('canceledKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="No Show Keywords" value={join(filters.noShowKeywords)} onChange={v => update('noShowKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Rescheduled Keywords" value={join(filters.rescheduledKeywords)} onChange={v => update('rescheduledKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="ROF Keywords" value={join(filters.rofKeywords)} onChange={v => update('rofKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Massage Keywords" value={join(filters.massageKeywords)} onChange={v => update('massageKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="New Patient Keywords" value={join(filters.newPatientKeywords)} onChange={v => update('newPatientKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Return Visit / Active Treatment" value={join(filters.returnVisitKeywords)} onChange={v => update('returnVisitKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Traction Keywords" value={join(filters.tractionKeywords)} onChange={v => update('tractionKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Therapy Keywords" value={join(filters.therapyKeywords)} onChange={v => update('therapyKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Re-Exam Keywords" value={join(filters.reExamKeywords)} onChange={v => update('reExamKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Final Eval Keywords" value={join(filters.finalEvalKeywords)} onChange={v => update('finalEvalKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="PTF Keywords" value={join(filters.ptfKeywords)} onChange={v => update('ptfKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="Supportive Care Keywords" value={join(filters.supportiveCareKeywords)} onChange={v => update('supportiveCareKeywords', v)} onBlur={handleBlur} />
          <KeywordInput label="LTC Keywords" value={join(filters.ltcKeywords)} onChange={v => update('ltcKeywords', v)} onBlur={handleBlur} />
          <div className="sm:col-span-2 lg:col-span-3">
            <KeywordInput
              label="Excluded Purpose Keywords (phone/admin)"
              value={join(filters.excludedPurposeKeywords)}
              onChange={v => update('excludedPurposeKeywords', v)}
              onBlur={handleBlur}
            />
            <p className="text-xs text-muted-foreground mt-1">
              These appointment types will be excluded from Retention Rate, Total Completed, and Weekly Average calculations.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const KeywordInput = ({ label, value, onChange, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; onBlur?: () => void;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="Enter comma-separated keywords, e.g. therapy, therapy 30"
    />
  </div>
);
