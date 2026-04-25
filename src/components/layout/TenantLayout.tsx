import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Building2, ClipboardList, FileCheck, FileText, Home, LogOut, Settings, Users, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";

const tenantNavItems = [
  { to: "/painel", label: "Coletas", icon: ClipboardList },
  { to: "/imoveis", label: "Imóveis", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/tipos-proposta", label: "Tipos de Proposta", icon: FileText },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/corretores", label: "Corretores", icon: UserCog },
];

export default function TenantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { memberships, activeTenantId, setActiveTenantId, signOut, isPlatformAdmin } = useAuth();
  const [logoBroken, setLogoBroken] = useState(false);

  const active = memberships.find((m) => m.tenantId === activeTenantId) || null;
  const tenantName = active?.tenant?.nome || "Imobiliária";
  const logoSrc = useMemo(() => "/images/logo-pactadoc.png", []);
  const goSettings = () => navigate("/configuracoes-imobiliaria");
  const navItems = useMemo(() => {
    if (!isPlatformAdmin) return tenantNavItems;
    return [
      ...tenantNavItems,
      { to: "/contratos", label: "Contratos", icon: FileCheck },
      { to: "/imobiliarias", label: "Imobiliárias", icon: Building2 },
    ];
  }, [isPlatformAdmin]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-[#041126] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              {logoBroken ? (
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  P
                </div>
              ) : (
                <img
                  src={logoSrc}
                  alt="PactaDoc"
                  className="w-9 h-9 rounded-xl bg-primary/10 object-contain p-1"
                  onError={() => setLogoBroken(true)}
                />
              )}
              <div className="leading-tight">
                <div className="font-display font-bold text-foreground">PactaDoc</div>
                <div className="text-xs text-muted-foreground">Área da imobiliária</div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              {memberships.length > 1 ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Select value={activeTenantId || ""} onValueChange={(v) => setActiveTenantId(v || null)}>
                    <SelectTrigger className="h-9 w-[260px] max-w-[40vw]">
                      <SelectValue placeholder="Selecione a imobiliária" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberships.map((m) => (
                        <SelectItem key={m.tenantId} value={m.tenantId}>
                          {m.tenant?.nome || m.tenantId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={goSettings} className="text-slate-300/70 hover:text-pacta-primary">
                    <Settings className="w-4 h-4 mr-1.5" />
                    {tenantName}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={goSettings}
                  className="text-sm text-foreground truncate max-w-[45vw] hover:text-pacta-primary transition-colors"
                >
                  {tenantName}
                </button>
              )}
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((it) => {
              const Icon = it.icon;
              const isActive = location.pathname === it.to;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-white/5 text-pacta-primary"
                      : "text-slate-300/70 hover:text-slate-100 hover:bg-white/5",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {it.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              {memberships.length > 1 ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Select value={activeTenantId || ""} onValueChange={(v) => setActiveTenantId(v || null)}>
                    <SelectTrigger className="h-9 w-[170px] max-w-[40vw]">
                      <SelectValue placeholder="Imobiliária" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberships.map((m) => (
                        <SelectItem key={m.tenantId} value={m.tenantId}>
                          {m.tenant?.nome || m.tenantId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={goSettings} className="text-slate-300/70 hover:text-pacta-primary">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={goSettings}
                  className="text-sm text-foreground truncate max-w-[45vw] hover:text-pacta-primary transition-colors"
                >
                  {tenantName}
                </button>
              )}
            </div>
            {isPlatformAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="text-slate-300/70 hover:text-slate-100 hover:bg-white/5"
              >
                Área Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        <div className="lg:hidden border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto">
            {navItems.map((it) => {
              const Icon = it.icon;
              const isActive = location.pathname === it.to;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-white/5 text-pacta-primary"
                      : "text-slate-300/70 hover:text-slate-100 hover:bg-white/5",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {it.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

