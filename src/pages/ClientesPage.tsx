import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, ChevronRight, ChevronUp, FileText, Loader2, Users, BarChart3, ClipboardList, Pencil, Upload, Link2, Mail, Phone, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";

type ClienteRow = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  imobiliaria_id: string;
  origem_proposta_id: string | null;
  created_at: string;
};

type ClienteDocumentoRow = {
  id: string;
  cliente_id: string;
  nome: string;
  url: string;
};

type ClientePropostaRow = {
  cliente_id: string;
  tipo_pessoa: string;
  propostas: {
    id: string;
    token: string;
    status: string;
    created_at: string;
  } | null;
};

export default function ClientesPage() {
  const navigate = useNavigate();
  const { isPlatformAdmin, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [docs, setDocs] = useState<ClienteDocumentoRow[]>([]);
  const [clientePropostas, setClientePropostas] = useState<ClientePropostaRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingForClienteId, setUploadingForClienteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [clientesRes, docsRes, relRes] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("cliente_documentos").select("id, cliente_id, nome, url").limit(6000),
      supabase
        .from("cliente_propostas")
        .select("cliente_id, tipo_pessoa, propostas(id, token, status, created_at)")
        .limit(6000),
    ]);
    setClientes((clientesRes.data as ClienteRow[]) || []);
    setDocs((docsRes.data as ClienteDocumentoRow[]) || []);
    setClientePropostas((relRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
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

  const propostasByCliente = useMemo(() => {
    const map = new Map<string, ClientePropostaRow[]>();
    for (const r of clientePropostas) {
      const arr = map.get(r.cliente_id) || [];
      arr.push(r);
      map.set(r.cliente_id, arr);
    }
    return map;
  }, [clientePropostas]);

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

  const openEdit = (cliente: ClienteRow) => {
    setEditing({ ...cliente });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const patch = {
        nome_completo: editing.nome_completo,
        cpf: editing.cpf,
        documento_tipo: editing.documento_tipo,
        documento_numero: editing.documento_numero,
        telefone: editing.telefone,
        email: editing.email,
        endereco: editing.endereco,
        bairro: editing.bairro,
        cidade: editing.cidade,
        estado: editing.estado,
        cep: editing.cep,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("clientes").update(patch).eq("id", editing.id);
      if (error) throw error;
      toast.success("Cliente atualizado com sucesso.");
      setEditOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const openUpload = (clienteId: string) => {
    setUploadingForClienteId(clienteId);
    uploadInputRef.current?.click();
  };

  const handleUploadForCliente = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!uploadingForClienteId || files.length === 0) return;

    try {
      for (const file of files) {
        const path = `clientes/${uploadingForClienteId}/${Date.now()}_${file.name}`;
        const upload = await supabase.storage.from("proposta-docs").upload(path, file);
        if (upload.error) throw upload.error;
        const { data: urlData } = supabase.storage.from("proposta-docs").getPublicUrl(path);
        const ins = await supabase.from("cliente_documentos").insert({
          cliente_id: uploadingForClienteId,
          nome: file.name,
          tipo: file.type || null,
          tamanho: file.size,
          url: urlData.publicUrl,
          uploaded_at: new Date().toISOString(),
        } as any);
        if (ins.error) throw ins.error;
      }
      toast.success("Documento(s) anexado(s) ao cliente.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao anexar documentos.");
    } finally {
      setUploadingForClienteId(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const toggleExpanded = (clienteId: string) => {
    setExpanded((prev) => ({ ...prev, [clienteId]: !prev[clienteId] }));
  };

  const getStatusVariant = (status: string) => {
    if (status === "enviado") return "default";
    if (status === "rascunho") return "secondary";
    return "outline";
  };

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
            <Button variant="ghost" size="sm" onClick={() => navigate("/corretores")}>
              <UserCog className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Corretores</span>
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
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          onChange={handleUploadForCliente}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        />

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-border rounded-xl p-10 text-center bg-card">
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[34%]">Cliente</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead className="text-center">Propostas</TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {filtered.map((c) => {
              const clienteDocs = docsByCliente.get(c.id) || [];
              const rels = propostasByCliente.get(c.id) || [];
              const papeis = rels.length > 0
                ? Array.from(new Set(rels.map((r) => (r.tipo_pessoa === "comprador" ? "Comprador" : "Vendedor")))).join(" / ")
                : "Cliente";
              const isExpanded = !!expanded[c.id];
              return (
                <Fragment key={c.id}>
                  <TableRow>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{c.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{c.cpf ? `CPF ${c.cpf}` : "CPF não informado"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Criado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{papeis}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{c.telefone || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="max-w-[210px] truncate">{c.email || "-"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{[c.cidade, c.estado].filter(Boolean).join(" / ") || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{rels.length}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{clienteDocs.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => openUpload(c.id)}>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Anexar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleExpanded(c.id)}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={7}>
                        <div className="grid lg:grid-cols-2 gap-4">
                          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Detalhes do Cliente
                            </p>
                            <div className="grid sm:grid-cols-2 gap-2 text-sm">
                              <p><span className="text-muted-foreground">Documento:</span> {c.documento_numero || "-"}</p>
                              <p><span className="text-muted-foreground">Tipo:</span> {c.documento_tipo || "-"}</p>
                              <p><span className="text-muted-foreground">CEP:</span> {c.cep || "-"}</p>
                              <p><span className="text-muted-foreground">Bairro:</span> {c.bairro || "-"}</p>
                              <p className="sm:col-span-2">
                                <span className="text-muted-foreground">Endereço:</span> {c.endereco || "-"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Propostas Vinculadas ({rels.length})
                            </p>
                            {rels.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Sem propostas vinculadas.</p>
                            ) : (
                              <div className="space-y-2">
                                {rels.slice(0, 10).map((r, idx) => {
                                  const prop = r.propostas;
                                  if (!prop) return null;
                                  return (
                                    <a
                                      key={`${prop.id}-${idx}`}
                                      href={`/proposta/${prop.token}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center justify-between text-sm px-2.5 py-2 rounded-md border border-border hover:bg-muted/40"
                                    >
                                      <span className="inline-flex items-center gap-1.5">
                                        <Link2 className="w-3.5 h-3.5" />
                                        {new Date(prop.created_at).toLocaleDateString("pt-BR")} • {r.tipo_pessoa}
                                      </span>
                                      <Badge variant={getStatusVariant(prop.status) as any}>{prop.status}</Badge>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="rounded-lg border border-border bg-background p-4 space-y-3 lg:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Documentos Anexados ({clienteDocs.length})
                            </p>
                            {clienteDocs.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Sem documentos vinculados.</p>
                            ) : (
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {clienteDocs.map((d) => (
                                  <a
                                    key={d.id}
                                    href={d.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm px-2.5 py-2 rounded-md border border-border hover:bg-muted/40"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span className="truncate">{d.nome}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>Nome Completo</Label>
                <Input value={editing.nome_completo} onChange={(e) => setEditing({ ...editing, nome_completo: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>CPF</Label>
                  <Input value={editing.cpf || ""} onChange={(e) => setEditing({ ...editing, cpf: e.target.value || null })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={editing.telefone || ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value || null })} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>E-mail</Label>
                  <Input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value || null })} />
                </div>
                <div>
                  <Label>Documento</Label>
                  <Input value={editing.documento_numero || ""} onChange={(e) => setEditing({ ...editing, documento_numero: e.target.value || null })} />
                </div>
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={editing.endereco || ""} onChange={(e) => setEditing({ ...editing, endereco: e.target.value || null })} />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>Bairro</Label>
                  <Input value={editing.bairro || ""} onChange={(e) => setEditing({ ...editing, bairro: e.target.value || null })} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={editing.cidade || ""} onChange={(e) => setEditing({ ...editing, cidade: e.target.value || null })} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input value={editing.estado || ""} onChange={(e) => setEditing({ ...editing, estado: e.target.value || null })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

