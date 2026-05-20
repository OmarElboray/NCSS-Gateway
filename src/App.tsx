import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalProvider } from "@/lib/portal-store";
import { ApplicantDashboard } from "@/pages/ApplicantDashboard";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { ReviewerDashboard } from "@/pages/ReviewerDashboard";
import { SignupPage } from "@/pages/SignupPage";
import { AdminRoute } from "@/components/AdminRoute";
import { AdminDashboard } from "@/pages/AdminDashboard";

export default function App() {
  return (
    <PortalProvider>
      <BrowserRouter>
        {/* Branding Header */}
        <header style={{ 
          padding: '1rem 2rem', 
          borderBottom: '1px solid #eaeaea',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '1rem'
        }}>
          <img src="/logo.png" alt="NCSS Gateway" style={{ height: '40px', width: 'auto' }} />
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '700' }}>NCSS Gateway</h1>
        </header>

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route 
            path="/applicant-dashboard" 
            element={<ProtectedRoute role="applicant"><ApplicantDashboard /></ProtectedRoute>} 
          />
          <Route 
            path="/reviewer-dashboard" 
            element={<ProtectedRoute role="reviewer"><ReviewerDashboard /></ProtectedRoute>} 
          />
          <Route 
            path="/admin-dashboard" 
            element={<AdminRoute><AdminDashboard /></AdminRoute>} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </PortalProvider>
  );
}