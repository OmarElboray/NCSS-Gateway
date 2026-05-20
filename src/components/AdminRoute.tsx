import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isAdminEmail } from "@/lib/admin";
import { usePortal } from "@/lib/portal-store";
import { getInitialSession } from "@/lib/supabase";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { authReady, currentUser } = usePortal();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    const verify = async () => {
      const session = await getInitialSession();
      const email = session?.user?.email ?? currentUser?.email ?? null;
      if (!cancelled) {
        setAllowed(isAdminEmail(email));
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser?.email]);

  if (!authReady || allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  if (!allowed) {
    const hasSession = Boolean(currentUser?.email);
    return (
      <Navigate to={hasSession ? "/" : "/login?role=applicant"} replace />
    );
  }

  return <>{children}</>;
}
