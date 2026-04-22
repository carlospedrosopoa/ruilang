import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Building2, ClipboardList, Copy, Download, FileDown, FileText, Loader2, Pencil, Search, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Imobiliaria = { id: string; nome: string };

type SubmissionRow = {
  id: string;
  tipo_contrato: string;
  imobiliaria_id: string | null;
  corretor_nome: string | null;
  status: string;
  created_at: string;
  contract_generated_at: string | null;
  contract_texto: string | null;
  contract_texto_updated_at: string | null;
  vendedor_nome: string | null;
  comprador_nome: string | null;
};

const ContratosGeradosPage = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [filterImobiliaria, setFilterImobiliaria] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SubmissionRow | null>(null);
  const [minutaText, setMinutaText] = useState("");
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const imobPromise = supabase.from("imobiliarias").select("id, nome").order("nome");
      const selectFull =
        "id, tipo_contrato, imobiliaria_id, corretor_nome, status, created_at, contract_generated_at, contract_texto, contract_texto_updated_at, dados";
      const selectFallback = "id, tipo_contrato, imobiliaria_id, corretor_nome, status, created_at, contract_generated_at, dados";

      const [imobRes, firstTry] = await Promise.all([
        imobPromise,
        supabase.from("submissions").select(selectFull).order("created_at", { ascending: false }).limit(2000),
      ]);

      let subsData = firstTry.data as any[] | null;
      if (firstTry.error) {
        const msg = String((firstTry.error as any)?.message || "");
        if (msg.toLowerCase().includes("contract_texto")) {
          const retry = await supabase.from("submissions").select(selectFallback).order("created_at", { ascending: false }).limit(2000);
          subsData = retry.data as any[] | null;
        } else {
          toast.error(msg || "Erro ao carregar contratos.");
        }
      }

      setImobiliarias((imobRes.data as Imobiliaria[]) || []);
      setRows(
        ((subsData as any[]) || []).map((r: any) => {
          const d = r?.dados;
          const vendedorNome = typeof d?.vendedores?.[0]?.nome === "string" ? d.vendedores[0].nome : null;
          const compradorNome = typeof d?.compradores?.[0]?.nome === "string" ? d.compradores[0].nome : null;
          return {
            contract_texto: null,
            contract_texto_updated_at: null,
            vendedor_nome: vendedorNome ? String(vendedorNome).trim() : null,
            comprador_nome: compradorNome ? String(compradorNome).trim() : null,
            ...r,
          } as SubmissionRow;
        }),
      );
      setLoading(false);
    };
    load();
  }, []);

  const imobiliariaById = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of imobiliarias) map.set(i.id, i.nome);
    return map;
  }, [imobiliarias]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterImobiliaria !== "all" && r.imobiliaria_id !== filterImobiliaria) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (!q) return true;
      const hay = [
        r.id,
        r.tipo_contrato,
        r.corretor_nome || "",
        r.vendedor_nome || "",
        r.comprador_nome || "",
        r.imobiliaria_id ? imobiliariaById.get(r.imobiliaria_id) || "" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filterImobiliaria, filterStatus, search, imobiliariaById]);

  const openWizard = (r: SubmissionRow) => {
    navigate(`/contrato/${r.tipo_contrato}?submissionId=${r.id}`);
  };

  const handleEditMinutaClick = (r: SubmissionRow) => {
    if (r.contract_texto && r.contract_texto.trim()) {
      openEditor(r);
      return;
    }
    toast.error("Este contrato ainda não tem minuta salva. Clique em “Abrir formulário” e gere a minuta primeiro.");
  };

  const openEditor = (r: SubmissionRow) => {
    setEditing(r);
    setMinutaText(r.contract_texto || "");
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    if (!editing) return;
    const text = minutaText.trim();
    if (!text) {
      toast.error("Informe o texto do contrato.");
      return;
    }
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("submissions")
        .update({
          contract_texto: text,
          contract_texto_updated_at: now,
          contract_texto_updated_by: userId,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;

      setRows((prev) =>
        prev.map((x) =>
          x.id === editing.id ? { ...x, contract_texto: text, contract_texto_updated_at: now } : x,
        ),
      );
      toast.success("Contrato atualizado.");
      setEditorOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar contrato.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!minutaText.trim()) return;
    await navigator.clipboard.writeText(minutaText);
    toast.success("Contrato copiado!");
  };

  const handleDownloadTxt = () => {
    if (!editing || !minutaText.trim()) return;
    const blob = new Blob([minutaText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contrato_${editing.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    if (!editing || !minutaText.trim()) return;
    setIsExportingDocx(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-docx", {
        body: { minuta: minutaText, tipoContrato: editing.tipo_contrato },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const byteChars = atob(data.docx);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${editing.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX baixado com sucesso!");
    } catch (err: any) {
      let message = err?.message || "Erro ao exportar DOCX.";
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (typeof body?.error === "string" && body.error.trim()) message = body.error;
        } catch {}
      }
      toast.error(message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/painel")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/images/logo-sielichow.png" alt="Sielichow Advocacia Empresarial" className="h-9 w-auto" />
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Sielichow</h1>
              <p className="text-xs text-muted-foreground">Contratos Gerados</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/painel")}>
              <ClipboardList className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Coletas</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <BarChart3 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/corretores")}>
              <UserCog className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Corretores</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/imobiliarias")}>
              <Building2 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Imobiliárias</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-display text-2xl font-bold text-foreground">Contratos</h2>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="ID, partes, corretor, tipo, imobiliária..." />
            </div>
          </div>
          <div>
            <Label>Imobiliária</Label>
            <Select value={filterImobiliaria} onValueChange={setFilterImobiliaria}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {imobiliarias.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="contrato_gerado">Contrato gerado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Imobiliária</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Partes</TableHead>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">
                        Nenhum contrato encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm">{r.imobiliaria_id ? (imobiliariaById.get(r.imobiliaria_id) || "-") : "-"}</TableCell>
                        <TableCell className="text-sm">{r.tipo_contrato}</TableCell>
                        <TableCell className="text-sm">
                          {r.created_at ? format(parseISO(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            <div className="truncate max-w-[220px]">
                              <span className="text-muted-foreground">1ª parte:</span> {r.vendedor_nome || "-"}
                            </div>
                            <div className="truncate max-w-[220px]">
                              <span className="text-muted-foreground">2ª parte:</span> {r.comprador_nome || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.corretor_nome || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {r.contract_generated_at ? format(parseISO(r.contract_generated_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="secondary">{r.status}</Badge>
                            <Badge variant={r.contract_texto ? "default" : "outline"}>
                              {r.contract_texto ? "Com minuta" : "Sem minuta"}
                            </Badge>
                            {r.contract_texto_updated_at ? (
                              <Badge variant="outline">
                                Editado {format(parseISO(r.contract_texto_updated_at), "dd/MM/yy", { locale: ptBR })}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => openWizard(r)}>
                              <FileText className="w-4 h-4 mr-1.5" />
                              Abrir formulário
                            </Button>
                            <Button size="sm" onClick={() => handleEditMinutaClick(r)} disabled={!r.contract_texto?.trim()}>
                              <Pencil className="w-4 h-4 mr-1.5" />
                              Editar minuta
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Editar Contrato</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="space-y-3">
                <Textarea value={minutaText} onChange={(e) => setMinutaText(e.target.value)} className="min-h-[420px]" />
              </div>
            </div>
            <div className="pt-4 flex items-center justify-between gap-2 border-t border-border flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={!minutaText.trim()}>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTxt} disabled={!minutaText.trim()}>
                  <Download className="w-4 h-4 mr-1.5" />
                  .txt
                </Button>
                <Button size="sm" onClick={handleDownloadDocx} disabled={!minutaText.trim() || isExportingDocx}>
                  {isExportingDocx ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileDown className="w-4 h-4 mr-1.5" />}
                  {isExportingDocx ? "Gerando..." : "Baixar .docx"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={saveEditor} disabled={saving || !minutaText.trim()}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ContratosGeradosPage;
