import { useNavigate } from 'react-router-dom';
import { DualReportUploader } from '@/components/upload/DualReportUploader';
import { useDashboard } from '@/lib/context/DashboardContext';
import type { ParsedEndOfDay, ParsedCMR } from '@/types/reports';
import { toast } from 'sonner';

const Upload = () => {
  const navigate = useNavigate();
  const { loadData } = useDashboard();

  const handleReportsParsed = (endOfDay: ParsedEndOfDay, cmr: ParsedCMR) => {
    sessionStorage.setItem('parsedEndOfDay', JSON.stringify(endOfDay));
    sessionStorage.setItem('parsedCMR', JSON.stringify(cmr));
    loadData(endOfDay, cmr);
    toast.success(
      `Parsed ${endOfDay.appointments.length} appointments + ${cmr.rows.length} cancel/reschedule events`
    );
    navigate('/executive-brief');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">CTC KPI Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Upload your ChiroTouch Cloud exports to analyze key performance indicators.
            You'll need both the <strong>End-of-Day Report</strong> and the <strong>Canceled/Missed/Rescheduled</strong> report.
          </p>
        </div>
        <DualReportUploader onReportsParsed={handleReportsParsed} />
      </div>
    </div>
  );
};

export default Upload;
