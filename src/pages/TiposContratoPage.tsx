import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooterUI,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TipoContratoRow = {
  id: string;
  imobiliaria_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string;
  label_vendedor: string;
  label_comprador: string;
  modelo_base: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

type PerfilRow = {
  codigo: string;
  nome: string;
  descricao: string | null;
  icone: string;
  instructions_ia: string | null;
  ativo: boolean;
};

export default function TiposContratoPage() {
  const { activeTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TipoContratoRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [labelVendedor, setLabelVendedor] = useState("Vendedor");
  const [labelComprador, setLabelComprador] = useState("Comprador");
  const [ativo, setAtivo] = useState(true);

  const [perfis, setPerfis] = useState<PerfilRow[]>([]);
  const [loadingPerfis, setLoadingPerfis] = useState(false);
  const [configuredPerfis, setConfiguredPerfis] = useState<Set<string>>(new Set());
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [editingPerfilCodigo, setEditingPerfilCodigo] = useState<string | null>(null);
  const [deletingPerfilCodigo, setDeletingPerfilCodigo] = useState<string | null>(null);
  const [perfilNome, setPerfilNome] = useState("");
  const [perfilDescricao, setPerfilDescricao] = useState("");
  const [perfilIcone, setPerfilIcone] = useState("Scale");
  const [perfilInstructions, setPerfilInstructions] = useState("");

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templatePerfilCodigo, setTemplatePerfilCodigo] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const [templateInstructions, setTemplateInstructions] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TipoContratoRow | null>(null);
  const [deletingTipo, setDeletingTipo] = useState(false);

  const canLoad = Boolean(activeTenantId);

  const loadPerfis = async (tipoId: string) => {
    if (!activeTenantId) return;
    setLoadingPerfis(true);
    try {
      const { data, error } = await supabase
        .from("perfis_contrato")
        .select("codigo, nome, descricao, icone, instructions_ia, ativo")
        .eq("imobiliaria_id", activeTenantId)
        .eq("tipo_contrato_id", tipoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setPerfis((data as PerfilRow[]) || []);
    } catch (e: any) {
      setPerfis([]);
      toast.error(e?.message || "Erro ao carregar perfis.");
    } finally {
      setLoadingPerfis(false);
    }
  };

  const loadConfigured = async (tipoCodigo: string) => {
    if (!activeTenantId) return;
    const { data } = await supabase
      .from("contract_templates")
      .select("perfil")
      .eq("imobiliaria_id", activeTenantId)
      .eq("tipo_contrato", tipoCodigo)
      .eq("active", true)
      .limit(1000);
    setConfiguredPerfis(new Set<string>(((data as any[]) || []).map((r) => String(r.perfil))));
  };

  const load = async () => {
    if (!activeTenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_contrato")
      .select("id, imobiliaria_id, codigo, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_at, updated_at")
      .eq("imobiliaria_id", activeTenantId)
      .order("created_at", { ascending: true });
    if (error) {
      setRows([]);
      toast.error(error.message || "Erro ao carregar tipos de contrato.");
    } else {
      setRows((data as TipoContratoRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeTenantId]);

  const openNew = () => {
    setEditingId(null);
    setEditingCodigo(null);
    setNome("");
    setDescricao("");
    setLabelVendedor("Vendedor");
    setLabelComprador("Comprador");
    setAtivo(true);
    setPerfis([]);
    setConfiguredPerfis(new Set());
    setDialogOpen(true);
  };

  const openEdit = (row: TipoContratoRow) => {
    setEditingId(row.id);
    setEditingCodigo(row.codigo);
    setNome(row.nome || "");
    setDescricao(row.descricao || "");
    setLabelVendedor(row.label_vendedor || "Vendedor");
    setLabelComprador(row.label_comprador || "Comprador");
    setAtivo(Boolean(row.ativo));
    loadPerfis(row.id);
    loadConfigured(row.codigo);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    const n = nome.trim();
    if (!n) {
      toast.error("Informe o nome do tipo de contrato.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nome: n,
        descricao: descricao.trim() || null,
        label_vendedor: labelVendedor.trim() || "Vendedor",
        label_comprador: labelComprador.trim() || "Comprador",
        ativo,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error } = await supabase
          .from("tipos_contrato")
          .update(payload)
          .eq("id", editingId)
          .select("id, imobiliaria_id, codigo, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_at, updated_at")
          .single();
        if (error) throw error;
        setRows((prev) => prev.map((r) => (r.id === editingId ? (data as any) : r)));
        setEditingCodigo((data as any)?.codigo || editingCodigo);
        await loadPerfis(editingId);
        if ((data as any)?.codigo) await loadConfigured((data as any).codigo);
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;
        const { data, error } = await supabase
          .from("tipos_contrato")
          .insert({
            imobiliaria_id: activeTenantId,
            nome: n,
            descricao: descricao.trim() || null,
            icone: "FileText",
            label_vendedor: labelVendedor.trim() || "Vendedor",
            label_comprador: labelComprador.trim() || "Comprador",
            ativo,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .select("id, imobiliaria_id, codigo, nome, descricao, icone, label_vendedor, label_comprador, modelo_base, ativo, created_at, updated_at")
          .single();
        if (error) throw error;
        setRows((prev) => [...prev, data as any]);
        setEditingId((data as any).id);
        setEditingCodigo((data as any).codigo);
        await loadPerfis((data as any).id);
        await loadConfigured((data as any).codigo);
      }
      toast.success("Tipo de contrato salvo!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar tipo de contrato.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (row: TipoContratoRow) => {
    try {
      const next = !row.ativo;
      const { error } = await supabase
        .from("tipos_contrato")
        .update({ ativo: next, updated_at: new Date().toISOString() } as any)
        .eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ativo: next } : r)));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status.");
    }
  };

  const openDeleteTipo = (row: TipoContratoRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDeleteTipo = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    if (!deleteTarget) return;

    setDeletingTipo(true);
    try {
      const { count, error: countErr } = await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("imobiliaria_id", activeTenantId)
        .eq("tipo_contrato", deleteTarget.codigo);
      if (countErr) throw countErr;
      if ((count || 0) > 0) {
        toast.error(`Não é possível excluir: há ${count} contrato(s)/coleta(s) usando este tipo. Desative o tipo em vez disso.`);
        setDeleteOpen(false);
        return;
      }

      const { error: tplErr } = await supabase
        .from("contract_templates")
        .delete()
        .eq("imobiliaria_id", activeTenantId)
        .eq("tipo_contrato", deleteTarget.codigo);
      if (tplErr) throw tplErr;

      const { error: delErr } = await supabase.from("tipos_contrato").delete().eq("id", deleteTarget.id);
      if (delErr) throw delErr;

      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) {
        setDialogOpen(false);
        setEditingId(null);
        setEditingCodigo(null);
        setPerfis([]);
        setConfiguredPerfis(new Set());
      }
      toast.success("Tipo de contrato excluído.");
      setDeleteOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir tipo de contrato.");
    } finally {
      setDeletingTipo(false);
    }
  };

  const hasRows = rows.length > 0;
  const emptyText = useMemo(() => {
    if (!canLoad) return "Selecione uma imobiliária para visualizar os tipos de contrato.";
    return "Nenhum tipo de contrato cadastrado ainda.";
  }, [canLoad]);

  const openCreatePerfil = () => {
    if (!editingId) {
      toast.error("Salve o tipo de contrato primeiro.");
      return;
    }
    setEditingPerfilCodigo(null);
    setPerfilNome("");
    setPerfilDescricao("");
    setPerfilIcone("Scale");
    setPerfilInstructions("");
    setPerfilDialogOpen(true);
  };

  const openEditPerfil = (p: PerfilRow) => {
    setEditingPerfilCodigo(p.codigo);
    setPerfilNome(p.nome || "");
    setPerfilDescricao(p.descricao || "");
    setPerfilIcone(p.icone || "Scale");
    setPerfilInstructions(p.instructions_ia || "");
    setPerfilDialogOpen(true);
  };

  const savePerfil = async () => {
    if (!activeTenantId || !editingId) {
      toast.error("Selecione uma imobiliária e um tipo de contrato.");
      return;
    }
    if (!perfilNome.trim()) {
      toast.error("Informe o nome do perfil.");
      return;
    }
    setSavingPerfil(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      if (editingPerfilCodigo) {
        const { data, error } = await supabase
          .from("perfis_contrato")
          .update({
            nome: perfilNome.trim(),
            descricao: perfilDescricao.trim() || null,
            icone: perfilIcone,
            instructions_ia: perfilInstructions.trim() || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("imobiliaria_id", activeTenantId)
          .eq("tipo_contrato_id", editingId)
          .eq("codigo", editingPerfilCodigo)
          .select("codigo, nome, descricao, icone, instructions_ia, ativo")
          .single();
        if (error) throw error;
        setPerfis((prev) => prev.map((x) => (x.codigo === editingPerfilCodigo ? (data as any) : x)));
        toast.success("Perfil atualizado!");
      } else {
        const { data, error } = await supabase
          .from("perfis_contrato")
          .insert({
            imobiliaria_id: activeTenantId,
            tipo_contrato_id: editingId,
            nome: perfilNome.trim(),
            descricao: perfilDescricao.trim() || null,
            icone: perfilIcone,
            instructions_ia: perfilInstructions.trim() || null,
            ativo: true,
            created_by: userId,
            updated_at: new Date().toISOString(),
          } as any)
          .select("codigo, nome, descricao, icone, instructions_ia, ativo")
          .single();
        if (error) throw error;
        setPerfis((prev) => [...prev, data as any]);
        toast.success("Perfil adicionado!");
      }
      setPerfilDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar perfil.");
    } finally {
      setSavingPerfil(false);
    }
  };

  const deletePerfil = async (codigo: string) => {
    if (!activeTenantId || !editingId || !editingCodigo) return;
    const remaining = perfis.filter((p) => p.codigo !== codigo).length;
    if (remaining < 1) {
      toast.error("Cada tipo precisa ter pelo menos 1 perfil.");
      return;
    }
    if (!confirm("Excluir este perfil de blindagem? Esta ação também remove o modelo base associado.")) return;
    setDeletingPerfilCodigo(codigo);
    try {
      const { error: tplErr } = await supabase
        .from("contract_templates")
        .delete()
        .eq("imobiliaria_id", activeTenantId)
        .eq("tipo_contrato", editingCodigo)
        .eq("perfil", codigo);
      if (tplErr) throw tplErr;

      const { error } = await supabase
        .from("perfis_contrato")
        .delete()
        .eq("imobiliaria_id", activeTenantId)
        .eq("tipo_contrato_id", editingId)
        .eq("codigo", codigo);
      if (error) throw error;
      setPerfis((prev) => prev.filter((p) => p.codigo !== codigo));
      setConfiguredPerfis((prev) => {
        const next = new Set(prev);
        next.delete(codigo);
        return next;
      });
      toast.success("Perfil excluído.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir perfil.");
    } finally {
      setDeletingPerfilCodigo(null);
    }
  };

  const openTemplate = async (perfilCodigo: string) => {
    if (!activeTenantId || !editingCodigo) {
      toast.error("Salve o tipo de contrato primeiro.");
      return;
    }
    setTemplatePerfilCodigo(perfilCodigo);
    setTemplateOpen(true);
    setLoadingTemplate(true);
    try {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("template_text, instructions_ia")
        .eq("imobiliaria_id", activeTenantId)
        .eq("tipo_contrato", editingCodigo)
        .eq("perfil", perfilCodigo)
        .eq("active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setTemplateText((data as any)?.template_text || "");
      setTemplateInstructions((data as any)?.instructions_ia || "");
    } catch (e: any) {
      setTemplateText("");
      setTemplateInstructions("");
      toast.error(e?.message || "Erro ao carregar modelo base.");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const saveTemplate = async () => {
    if (!activeTenantId || !editingCodigo || !templatePerfilCodigo) return;
    if (!templateText.trim()) {
      toast.error("Informe o texto do modelo base.");
      return;
    }
    setSavingTemplate(true);
    try {
      const last = await supabase
        .from("contract_templates")
        .select("version")
        .eq("tipo_contrato", editingCodigo)
        .eq("perfil", templatePerfilCodigo)
        .eq("imobiliaria_id", activeTenantId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last.error) throw last.error;
      const nextVersion = ((last.data as any)?.version || 0) + 1;

      const { error: disableErr } = await supabase
        .from("contract_templates")
        .update({ active: false } as any)
        .eq("tipo_contrato", editingCodigo)
        .eq("perfil", templatePerfilCodigo)
        .eq("imobiliaria_id", activeTenantId);
      if (disableErr) throw disableErr;

      const { error: insErr } = await supabase.from("contract_templates").insert({
        imobiliaria_id: activeTenantId,
        tipo_contrato: editingCodigo,
        perfil: templatePerfilCodigo,
        provider: "manual",
        model: null,
        version: nextVersion,
        active: true,
        template_text: templateText.trim(),
        instructions_ia: templateInstructions.trim() || null,
        updated_at: new Date().toISOString(),
      } as any);
      if (insErr) throw insErr;

      setConfiguredPerfis((prev) => {
        const next = new Set(prev);
        next.add(templatePerfilCodigo);
        return next;
      });
      toast.success("Modelo base atualizado.");
      setTemplateOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar modelo base.");
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Tipos de Contrato</h1>
          <p className="text-muted-foreground">Crie e mantenha tipos por imobiliária, com perfis de blindagem por tipo.</p>
        </div>
        <Button onClick={openNew} disabled={!canLoad}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Tipo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !hasRows ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[56px]" />
                  <TableHead>Nome</TableHead>
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Editar tipo">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteTipo(r)} aria-label="Excluir tipo">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.nome}</TableCell>
                    <TableCell>
                      <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o tipo e todos os perfis de blindagem vinculados a ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooterUI>
            <AlertDialogCancel disabled={deletingTipo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTipo} disabled={deletingTipo}>
              {deletingTipo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooterUI>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Tipo de Contrato" : "Novo Tipo de Contrato"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Contrato de Arrendamento" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição (opcional)" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Label do Vendedor</Label>
                <Input value={labelVendedor} onChange={(e) => setLabelVendedor(e.target.value)} placeholder="Ex: Cedente" />
              </div>
              <div>
                <Label>Label do Comprador</Label>
                <Input value={labelComprador} onChange={(e) => setLabelComprador(e.target.value)} placeholder="Ex: Cessionário" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-foreground">Ativo</div>
                <div className="text-xs text-muted-foreground">Se desativado, não aparece como opção ao criar novas coletas</div>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-foreground">Perfis de Blindagem</div>
                  <div className="text-xs text-muted-foreground">Cada tipo deve ter pelo menos 1 perfil.</div>
                </div>
                <Button variant="outline" size="sm" onClick={openCreatePerfil} disabled={!editingId}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Perfil
                </Button>
              </div>

              {loadingPerfis ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando perfis...
                </div>
              ) : perfis.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum perfil encontrado.</div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Ícone</TableHead>
                        <TableHead className="w-[144px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perfis.map((p) => (
                        <TableRow key={p.codigo}>
                          <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                          <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{p.icone}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openTemplate(p.codigo)}
                                title="Editar modelo base"
                                aria-label="Editar modelo base"
                              >
                                <Settings className={configuredPerfis.has(p.codigo) ? "w-4 h-4" : "w-4 h-4 opacity-60"} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditPerfil(p)}
                                title="Editar perfil"
                                aria-label="Editar perfil"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deletePerfil(p.codigo)}
                                disabled={deletingPerfilCodigo === p.codigo}
                                title="Excluir perfil"
                                aria-label="Excluir perfil"
                              >
                                {deletingPerfilCodigo === p.codigo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perfilDialogOpen} onOpenChange={setPerfilDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingPerfilCodigo ? "Editar Perfil de Blindagem" : "Novo Perfil de Blindagem"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-4 pt-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={perfilNome} onChange={(e) => setPerfilNome(e.target.value)} placeholder="Ex: Blindagem Máxima" />
                </div>
                <div>
                  <Label>Ícone</Label>
                  <Select value={perfilIcone} onValueChange={setPerfilIcone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ShieldCheck">ShieldCheck</SelectItem>
                      <SelectItem value="ShieldAlert">ShieldAlert</SelectItem>
                      <SelectItem value="Scale">Scale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={perfilDescricao} onChange={(e) => setPerfilDescricao(e.target.value)} placeholder="Breve descrição do perfil" />
              </div>
              <div>
                <Label>Instruções para IA (opcional)</Label>
                <Textarea
                  value={perfilInstructions}
                  onChange={(e) => setPerfilInstructions(e.target.value)}
                  className="min-h-[160px]"
                  placeholder="Ex.: Priorizar cláusulas favoráveis ao vendedor; impor condições mais rígidas em caso de inadimplemento..."
                />
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-border">
            <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={savePerfil} disabled={savingPerfil || !perfilNome.trim()}>
              {savingPerfil ? "Salvando..." : editingPerfilCodigo ? "Salvar" : "Criar Perfil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Modelo Base do Perfil</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            {loadingTemplate ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Texto do Modelo Base</Label>
                  <Textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    className="min-h-[280px]"
                    placeholder="Cole aqui o texto do contrato base (sem peculiaridades)."
                  />
                </div>
                <div>
                  <Label>Instruções adicionais para IA (opcional)</Label>
                  <Textarea
                    value={templateInstructions}
                    onChange={(e) => setTemplateInstructions(e.target.value)}
                    className="min-h-[140px]"
                    placeholder="Ex.: Manter redação do modelo; não inventar dados; aplicar o perfil de blindagem em todo o contrato."
                  />
                </div>
              </div>
            )}
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-border">
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTemplate} disabled={savingTemplate || loadingTemplate}>
              {savingTemplate ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
