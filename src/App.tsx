import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { RequireAuth } from "@/auth/RequireAuth";
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
                <RequireAuth requirePlatformAdmin>
                  <ContratoPage />
                </RequireAuth>
              }
            />
            <Route path="/coleta/:token" element={<ColetaPage />} />
            <Route
              path="/painel"
              element={
                <RequireAuth>
                  <PainelSubmissoes />
                </RequireAuth>
              }
            />
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
              path="/relatorios"
              element={
                <RequireAuth>
                  <RelatoriosPage />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes"
              element={
                <RequireAuth>
                  <ClientesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/corretores"
              element={
                <RequireAuth>
                  <CorretoresPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardFluxoPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
