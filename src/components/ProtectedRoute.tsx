import { Navigate, useLocation } from "react-router-dom";
import { dashboardPathForRole } from "@/lib/profile";
import { usePortal } from "@/lib/portal-store";
import type { UserRole } from "@/lib/portal-types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  role: UserRole;
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { currentUser, authReady } = usePortal();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to={`/login?role=${role}`} state={{ from: location }} replace />;
  }

  if (currentUser.role !== role) {
    return <Navigate to={dashboardPathForRole(currentUser.role)} replace />;
  }

  return <>{children}</>;
}
