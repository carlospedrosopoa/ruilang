import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, FileText, Loader2, Users, BarChart3, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

type ClienteRow = {
  id: string;
  nome_completo: string;
  tipo_pessoa: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  origem_proposta_id: string | null;
  created_at: string;
};

type ClienteDocumentoRow = {
  id: string;
  cliente_id: string;
  nome: string;
  url: string;
};

export default function ClientesPage() {
  const navigate = useNavigate();
  const { isPlatformAdmin, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [docs, setDocs] = useState<ClienteDocumentoRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [clientesRes, docsRes] = await Promise.all([
        supabase.from("clientes").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("cliente_documentos").select("id, cliente_id, nome, url").limit(3000),
      ]);
      setClientes((clientesRes.data as ClienteRow[]) || []);
      setDocs((docsRes.data as ClienteDocumentoRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const docsByCliente = useMemo(() => {
    const map = new Map<string, ClienteDocumentoRow[]>();
    for (const d of docs) {
      const arr = map.get(d.cliente_id) || [];
      arr.push(d);
      map.set(d.cliente_id, arr);
    }
    return map;
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      return (
        c.nome_completo.toLowerCase().includes(q) ||
        (c.cpf || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.telefone || "").toLowerCase().includes(q)
      );
    });
  }, [clientes, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/painel")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/images/logo-sielichow.png" alt="Sielichow Advocacia Empresarial" className="h-9 w-auto" />
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Sielichow</h1>
              <p className="text-xs text-muted-foreground">Cadastro de Clientes</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/painel")}>
              <ClipboardList className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Coletas</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/relatorios")}>
              <BarChart3 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
            {isPlatformAdmin ? (
              <Button variant="ghost" size="sm" onClick={() => navigate("/imobiliarias")}>
                <Building2 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Imobiliárias</span>
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <ChevronRight className="w-4 h-4 mr-1.5 rotate-180" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-display text-2xl font-bold text-foreground">Clientes</h2>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail ou telefone"
            className="w-full sm:w-96"
          />
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-border rounded-xl p-10 text-center bg-card">
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((c) => {
              const clienteDocs = docsByCliente.get(c.id) || [];
              return (
                <div key={c.id} className="border border-border rounded-xl p-5 bg-card">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{c.nome_completo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {c.tipo_pessoa === "comprador" ? "Comprador" : "Vendedor"}
                        {c.cpf ? ` • CPF ${c.cpf}` : ""}
                      </p>
                    </div>
                    <div className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground grid sm:grid-cols-2 gap-2">
                    <p>{c.telefone || "-"}</p>
                    <p>{c.email || "-"}</p>
                    <p>{[c.cidade, c.estado].filter(Boolean).join(" / ") || "-"}</p>
                    <p>Proposta: {c.origem_proposta_id ? "Vinculada" : "Manual"}</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Documentos anexados ({clienteDocs.length})
                    </p>
                    {clienteDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem documentos vinculados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {clienteDocs.slice(0, 8).map((d) => (
                          <a
                            key={d.id}
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="max-w-[180px] truncate">{d.nome}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

