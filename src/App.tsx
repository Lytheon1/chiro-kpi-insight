import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardProvider } from "@/lib/context/DashboardContext";
import Upload from "./pages/Upload";
import DashboardLayout from "./pages/DashboardLayout";
import ExecutiveBriefPage from "./pages/ExecutiveBriefPage";
import OperationalAnalysisPage from "./pages/OperationalAnalysisPage";
import PatientReviewPage from "./pages/PatientReviewPage";
import ValidationPage from "./pages/ValidationPage";
import EvidencePage from "./pages/EvidencePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DashboardProvider>
          <Routes>
            <Route path="/" element={<Upload />} />
            <Route element={<DashboardLayout />}>
              <Route path="/executive-brief" element={<ExecutiveBriefPage />} />
              <Route path="/analysis" element={<OperationalAnalysisPage />} />
              <Route path="/patients" element={<PatientReviewPage />} />
              <Route path="/validation" element={<ValidationPage />} />
              <Route path="/evidence" element={<EvidencePage />} />
              {/* Legacy redirects */}
              <Route path="/summary" element={<Navigate to="/executive-brief" replace />} />
              <Route path="/providers" element={<Navigate to="/analysis" replace />} />
              <Route path="/trends" element={<Navigate to="/analysis" replace />} />
              <Route path="/diagnostics" element={<Navigate to="/validation" replace />} />
              <Route path="/dashboard" element={<Navigate to="/executive-brief" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
