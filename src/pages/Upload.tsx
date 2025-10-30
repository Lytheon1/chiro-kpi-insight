import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from '@/components/FileUpload';
import { ColumnMapper } from '@/components/ColumnMapper';
import { KeywordsConfig } from '@/components/KeywordsConfig';
import { Button } from '@/components/ui/button';
import { parseExcelFile, detectColumnMapping } from '@/utils/excelParser';
import { ColumnMapping, Keywords, AppointmentRow } from '@/types/dashboard';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

const defaultMapping: ColumnMapping = {
  status: 'Status',
  purpose: 'Purpose',
  provider: 'Provider',
  date: 'Date',
  patient: 'Patient',
};

const defaultKeywords: Keywords = {
  completed: 'checked',
  canceled: 'cancel',
  noShow: 'no show',
  rof: 'ROF',
  massageExclude: 'Massage',
};

const Upload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(defaultMapping);
  const [keywords, setKeywords] = useState<Keywords>(defaultKeywords);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (selectedFiles: File[]) => {
    setFiles(selectedFiles);

    // Auto-detect column mapping from first file
    if (selectedFiles.length > 0) {
      try {
        const file = selectedFiles[0];
        const reader = new FileReader();

        reader.onload = (e) => {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

          // Find header row
          for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
              const hasRelevantHeaders = row.some((cell: any) => {
                const normalized = cell?.toString().toLowerCase() || '';
                return normalized.includes('status') || 
                       normalized.includes('purpose') || 
                       normalized.includes('provider');
              });

              if (hasRelevantHeaders) {
                const headers = row.map((h: any) => h?.toString() || '');
                const detected = detectColumnMapping(headers);
                setMapping(detected);
                toast.success('Column mapping auto-detected');
                break;
              }
            }
          }
        };

        reader.readAsBinaryString(file);
      } catch (error) {
        console.error('Failed to auto-detect columns:', error);
      }
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setIsProcessing(true);

    try {
      const allRows: AppointmentRow[] = [];

      for (const file of files) {
        const rows = await parseExcelFile(file, mapping, keywords);
        allRows.push(...rows);
      }

      if (allRows.length === 0) {
        toast.error('No valid appointment data found in the uploaded file(s)');
        setIsProcessing(false);
        return;
      }

      // Calculate date range
      const dates = allRows
        .map(r => r.date)
        .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

      const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
      const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

      // Get unique providers
      const providers = Array.from(
        new Set(
          allRows
            .map(r => r[mapping.provider]?.toString())
            .filter((p): p is string => !!p && p.trim().length > 0)
        )
      ).sort();

      // Calculate weeks based on actual weeks with data (not calendar span)
      let weeks = 1;
      if (minDate && maxDate) {
        // Create a set of unique week starts
        const uniqueWeeks = new Set<string>();
        
        allRows.forEach(row => {
          if (!row.date) return;
          const date = row.date instanceof Date ? row.date : new Date(row.date);
          if (isNaN(date.getTime())) return;
          
          // Get start of week (Monday)
          const dateCopy = new Date(date);
          const dayOfWeek = dateCopy.getDay();
          const diff = dateCopy.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const weekStart = new Date(dateCopy.getFullYear(), dateCopy.getMonth(), diff);
          weekStart.setHours(0, 0, 0, 0);
          
          uniqueWeeks.add(weekStart.toISOString().split('T')[0]);
        });
        
        weeks = Math.max(1, uniqueWeeks.size); // Use actual number of weeks with data
        
        console.log('Week Calculation:', {
          dateSpan: `${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`,
          actualWeeksWithData: weeks,
          uniqueWeekStarts: Array.from(uniqueWeeks).sort()
        });
      }

      // Store in session storage
      sessionStorage.setItem('dashboardData', JSON.stringify({
        rows: allRows,
        dateRange: { 
          min: minDate?.toISOString() || null, 
          max: maxDate?.toISOString() || null 
        },
        providers,
        weeks,
        mapping,
        keywords,
      }));

      toast.success(`Processed ${allRows.length} appointments from ${files.length} file(s)`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to process files:', error);
      toast.error('Failed to process files. Please check the file format and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">CTC KPI Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Upload your ChiroTouch Cloud End of Day appointments export to analyze key performance indicators
          </p>
        </div>

        <div className="space-y-6">
          <FileUpload onFileSelect={handleFileSelect} />

          {files.length > 0 && (
            <>
              <div className="grid gap-6 md:grid-cols-1">
                <ColumnMapper mapping={mapping} onMappingChange={setMapping} />
                <KeywordsConfig keywords={keywords} onKeywordsChange={setKeywords} />
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleProcess} 
                  disabled={isProcessing}
                  size="lg"
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Process & View Dashboard
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;
