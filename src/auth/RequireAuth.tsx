import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

export function RequireAuth({
  children,
  requirePlatformAdmin = false,
}: {
  children: React.ReactNode;
  requirePlatformAdmin?: boolean;
}) {
  const { loading, session, isPlatformAdmin, activeTenantId } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requirePlatformAdmin && !isPlatformAdmin) {
    return <Navigate to="/painel" replace />;
  }

  if (!isPlatformAdmin && !activeTenantId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h2 className="font-display text-xl font-bold text-foreground">Acesso não configurado</h2>
          <p className="text-muted-foreground">Seu usuário ainda não está vinculado a uma imobiliária.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

