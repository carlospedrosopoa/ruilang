import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { RequireAuth } from "@/auth/RequireAuth";
import TenantLayout from "@/components/layout/TenantLayout";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import ContratoPage from "./pages/ContratoPage.tsx";
import ColetaPage from "./pages/ColetaPage.tsx";
import PainelSubmissoes from "./pages/PainelSubmissoes.tsx";
import ImobiliariasPage from "./pages/ImobiliariasPage.tsx";
import PropostaPage from "./pages/PropostaPage.tsx";
import RelatoriosPage from "./pages/RelatoriosPage.tsx";
import ClientesPage from "./pages/ClientesPage.tsx";
import CorretoresPage from "./pages/CorretoresPage.tsx";
import DashboardFluxoPage from "./pages/DashboardFluxoPage.tsx";
import ContratosGeradosPage from "./pages/ContratosGeradosPage.tsx";
import ImoveisPage from "./pages/ImoveisPage.tsx";
import TiposPropostaPage from "./pages/TiposPropostaPage.tsx";
import ImobiliariaSettingsPage from "./pages/ImobiliariaSettingsPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth requirePlatformAdmin>
                  <Index />
                </RequireAuth>
              }
            />
            <Route
              path="/contrato/:tipo"
              element={
                <RequireAuth>
                  <ContratoPage />
                </RequireAuth>
              }
            />
            <Route path="/coleta/:token" element={<ColetaPage />} />
            <Route
              path="/imobiliarias"
              element={
                <RequireAuth requirePlatformAdmin>
                  <ImobiliariasPage />
                </RequireAuth>
              }
            />
            <Route path="/proposta/:token" element={<PropostaPage />} />
            <Route
              element={
                <RequireAuth>
                  <TenantLayout />
                </RequireAuth>
              }
            >
              <Route path="/painel" element={<PainelSubmissoes />} />
              <Route path="/contratos" element={<ContratosGeradosPage />} />
              <Route path="/imoveis" element={<ImoveisPage />} />
              <Route path="/dashboard" element={<DashboardFluxoPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/corretores" element={<CorretoresPage />} />
              <Route path="/tipos-proposta" element={<TiposPropostaPage />} />
              <Route path="/configuracoes-imobiliaria" element={<ImobiliariaSettingsPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
