import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseEndOfDayAppointments } from '@/lib/parsers/parseEndOfDayAppointments';
import { parseCanceledMissedRescheduled } from '@/lib/parsers/parseCanceledMissedRescheduled';
import type { ParsedEndOfDay, ParsedCMR } from '@/types/reports';
import { toast } from 'sonner';

interface DualReportUploaderProps {
  onReportsParsed: (endOfDay: ParsedEndOfDay, cmr: ParsedCMR) => void;
}

interface SlotState {
  file: File | null;
  status: 'empty' | 'validating' | 'valid' | 'error';
  error?: string;
}

export const DualReportUploader = ({ onReportsParsed }: DualReportUploaderProps) => {
  const [reportA, setReportA] = useState<SlotState>({ file: null, status: 'empty' });
  const [reportB, setReportB] = useState<SlotState>({ file: null, status: 'empty' });
  const [parsedA, setParsedA] = useState<ParsedEndOfDay | null>(null);
  const [parsedB, setParsedB] = useState<ParsedCMR | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileA = useCallback(async (file: File) => {
    setReportA({ file, status: 'validating' });
    try {
      const result = await parseEndOfDayAppointments(file);
      setParsedA(result);
      setReportA({ file, status: 'valid' });
      toast.success(`Report A: ${result.appointments.length} appointments parsed`);
    } catch (err: any) {
      setReportA({ file, status: 'error', error: err.message });
      setParsedA(null);
    }
  }, []);

  const handleFileB = useCallback(async (file: File) => {
    setReportB({ file, status: 'validating' });
    try {
      const result = await parseCanceledMissedRescheduled(file);
      setParsedB(result);
      setReportB({ file, status: 'valid' });
      toast.success(`Report B: ${result.rows.length} events parsed`);
    } catch (err: any) {
      setReportB({ file, status: 'error', error: err.message });
      setParsedB(null);
    }
  }, []);

  const handleAnalyze = () => {
    if (!parsedA || !parsedB) return;

    // Date range mismatch warning
    if (parsedA.minDate && parsedB.minDate && parsedA.maxDate && parsedB.maxDate) {
      if (parsedA.minDate !== parsedB.minDate || parsedA.maxDate !== parsedB.maxDate) {
        toast.warning(
          `Report A covers ${parsedA.minDate} to ${parsedA.maxDate} but Report B covers ${parsedB.minDate} to ${parsedB.maxDate}. Results may be inconsistent.`
        );
      }
    }

    if (parsedA.appointments.length === 0) {
      toast.error('No appointment rows found in Report A. Check that this is the correct file.');
      return;
    }

    setIsAnalyzing(true);
    try {
      onReportsParsed(parsedA, parsedB);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <ReportSlot
          label="Report A"
          description="End-of-Day Appointments"
          expectedType="End-of-Day Report"
          state={reportA}
          parsedInfo={parsedA ? `${parsedA.appointments.length} appointments, ${parsedA.dailyTotals.length} daily totals, ${parsedA.providers.length} providers` : undefined}
          dateRange={parsedA?.minDate && parsedA?.maxDate ? `${parsedA.minDate} → ${parsedA.maxDate}` : undefined}
          onFileDrop={handleFileA}
        />
        <ReportSlot
          label="Report B"
          description="Canceled/Missed/Rescheduled"
          expectedType="Canceled/Missed/Rescheduled"
          state={reportB}
          parsedInfo={parsedB ? `${parsedB.rows.length} events, ${parsedB.providers.length} providers` : undefined}
          dateRange={parsedB?.minDate && parsedB?.maxDate ? `${parsedB.minDate} → ${parsedB.maxDate}` : undefined}
          onFileDrop={handleFileB}
        />
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          disabled={reportA.status !== 'valid' || reportB.status !== 'valid' || isAnalyzing}
          onClick={handleAnalyze}
          className="gap-2 px-8"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Reports'}
        </Button>
      </div>

      {(reportA.status !== 'valid' || reportB.status !== 'valid') && (reportA.file || reportB.file) && (
        <p className="text-center text-sm text-muted-foreground">
          Please upload both Report A and Report B before analyzing.
        </p>
      )}
    </div>
  );
};

interface ReportSlotProps {
  label: string;
  description: string;
  expectedType: string;
  state: SlotState;
  parsedInfo?: string;
  dateRange?: string;
  onFileDrop: (file: File) => void;
}

const ReportSlot = ({ label, description, expectedType, state, parsedInfo, dateRange, onFileDrop }: ReportSlotProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.xls') || f.name.endsWith('.xlsx')
    );
    if (files[0]) onFileDrop(files[0]);
  }, [onFileDrop]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileDrop(file);
  }, [onFileDrop]);

  const inputId = `file-upload-${label.replace(/\s/g, '-')}`;

  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-all duration-200',
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        state.status === 'valid' && 'border-success/50 bg-success/5',
        state.status === 'error' && 'border-destructive/50 bg-destructive/5'
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className={cn(
            'p-4 rounded-full transition-colors',
            state.status === 'valid' ? 'bg-success/10 text-success' :
            state.status === 'error' ? 'bg-destructive/10 text-destructive' :
            isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {state.status === 'valid' ? <CheckCircle2 className="h-8 w-8" /> :
             state.status === 'error' ? <XCircle className="h-8 w-8" /> :
             <Upload className="h-8 w-8" />}
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        {state.status === 'empty' && (
          <>
            <input type="file" id={inputId} className="hidden" accept=".xls,.xlsx" onChange={handleFileInput} />
            <label htmlFor={inputId}>
              <Button asChild variant="outline" size="sm">
                <span>Browse Files</span>
              </Button>
            </label>
          </>
        )}

        {state.status === 'validating' && (
          <p className="text-sm text-muted-foreground">Validating...</p>
        )}

        {state.status === 'valid' && state.file && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{state.file.name}</span>
            </div>
            <Badge variant="outline" className="border-success text-success">✅ Validated</Badge>
            {parsedInfo && <p className="text-xs text-muted-foreground">{parsedInfo}</p>}
            {dateRange && <p className="text-xs text-muted-foreground">Date range: {dateRange}</p>}
            <div className="pt-2">
              <input type="file" id={inputId} className="hidden" accept=".xls,.xlsx" onChange={handleFileInput} />
              <label htmlFor={inputId}>
                <Button asChild variant="ghost" size="sm">
                  <span>Replace file</span>
                </Button>
              </label>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-2">
            <Badge variant="destructive">❌ Wrong report type</Badge>
            {state.error && (
              <div className="flex items-start gap-2 text-xs text-destructive max-w-xs mx-auto">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}
            <div className="pt-2">
              <input type="file" id={inputId} className="hidden" accept=".xls,.xlsx" onChange={handleFileInput} />
              <label htmlFor={inputId}>
                <Button asChild variant="outline" size="sm">
                  <span>Try another file</span>
                </Button>
              </label>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
