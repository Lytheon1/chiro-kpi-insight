import { useNavigate } from 'react-router-dom';
import { DualReportUploader } from '@/components/upload/DualReportUploader';
import { useDashboard } from '@/lib/context/DashboardContext';
import type { ParsedEndOfDay, ParsedCMR } from '@/types/reports';
import { toast } from 'sonner';

const Upload = () => {
  const navigate = useNavigate();
  const { loadData } = useDashboard();

  const handleReportsParsed = (endOfDay: ParsedEndOfDay, cmr: ParsedCMR) => {
    // Store in session storage for persistence across refreshes
    sessionStorage.setItem('parsedEndOfDay', JSON.stringify(endOfDay));
    sessionStorage.setItem('parsedCMR', JSON.stringify(cmr));

    // Load into context
    loadData(endOfDay, cmr);

    toast.success(
      `Parsed ${endOfDay.appointments.length} appointments + ${cmr.rows.length} cancel/reschedule events`
    );
    navigate('/summary');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">CTC KPI Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Upload your ChiroTouch Cloud exports to analyze key performance indicators.
            You'll need both the <strong>End-of-Day Report</strong> and the <strong>Canceled/Missed/Rescheduled</strong> report for the same date range.
          </p>
        </div>

        <DualReportUploader onReportsParsed={handleReportsParsed} />
      </div>
    </div>
  );
};

export default Upload;
