import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import LeadDetail from "@/pages/LeadDetail";
import Messages from "@/pages/Messages";
import Vehicles from "@/pages/Vehicles";
import VehicleDetail from "@/pages/VehicleDetail";
import VehicleImport from "@/pages/VehicleImport";
import Reservations from "@/pages/Reservations";
import CalendarPage from "@/pages/CalendarPage";
import Documents from "@/pages/Documents";
import FAQ from "@/pages/FAQ";
import SiteMultipliers from "@/pages/SiteMultipliers";
import NotFound from "@/pages/NotFound";


const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/vehicles/import" element={<VehicleImport />} />
        <Route path="/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/site-multipliers" element={<SiteMultipliers />} />
        <Route path="*" element={<NotFound />} />

      </Routes>
    </AdminLayout>
  );
}

function LoginRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
