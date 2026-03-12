import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardProvider } from "@/lib/context/DashboardContext";
import Upload from "./pages/Upload";
import DashboardLayout from "./pages/DashboardLayout";
import SummaryPage from "./pages/SummaryPage";
import PatientsPage from "./pages/PatientsPage";
import ProvidersPage from "./pages/ProvidersPage";
import TrendsPage from "./pages/TrendsPage";
import DiagnosticsPage from "./pages/DiagnosticsPage";
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
              <Route path="/summary" element={<SummaryPage />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
              <Route path="/dashboard" element={<Navigate to="/summary" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
